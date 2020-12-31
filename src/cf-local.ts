/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fsextra from "fs-extra";
import * as os from 'os';
import * as path from 'path';
import { parse, stringify } from "comment-json";
import * as _ from "lodash";
import { Cli } from "./cli";
import { messages } from "./messages";
import {
    ProgressHandler, CliResult, CFResource, CancellationToken, CFTarget, ServiceInstanceInfo, ServiceInfo, PlanInfo,
    DEFAULT_TARGET, IServiceQuery, NEW_LINE, OK, eFilters, IServiceFilters, eOperation, ITarget, UpsTypeInfo
} from './types';
import { ensureQuery } from "./utils";
import { SpawnOptions } from "child_process";

function getGuid(resource: any): string {
    return _.get(resource, "metadata.guid", '');
}

function getName(resource: any): string {
    return _.get(resource, "entity.name", '');
}

function getLabel(resource: any): string {
    return _.get(resource, "entity.label", '');
}

function getDescription(resource: any): string {
    return _.get(resource, "entity.description", '');
}

function getSpaceFieldGUID(spaceField: any): string {
    return _.get(spaceField, "GUID", '');
}

function getOrgGUID(resource: any): string {
    return _.get(resource, "entity.organization_guid", '');
}

function getTags(resource: any): string[] {
    return _.get(resource, "entity.tags", []);
}

function getCredentials(resource: any): any {
    return _.get(resource, "entity.credentials", {});
}

let cacheServiceInstanceTypes: any = {};
export function clearCacheServiceInstances() {
    cacheServiceInstanceTypes = {};
}

export function cfGetConfigFilePath(): string {
    return path.join(_.get(process, "env.CF_HOME", os.homedir()), ".cf", "config.json");
}

export async function cfGetConfigFileField(field: string): Promise<any> {
    try {
        const configJson = parse(await fsextra.readFile(cfGetConfigFilePath(), "utf8"));
        return _.get(configJson, `${field}`);
    } catch (error) {
        // empty or non existing file
    }
}

async function padQuerySpace(query: IServiceQuery): Promise<IServiceQuery> {
    query = ensureQuery(query);
    const filter = _.find(query.filters, ['key', eFilters.space_guid]);
    if (!_.get(filter, 'value')) {
        const space: string = getSpaceFieldGUID(await cfGetConfigFileField("SpaceFields"));
        if (!space) {
            throw new Error(messages.cf_setting_not_set);
        }
        query.filters = _.concat(query.filters, [{ key: eFilters.space_guid, value: space }]);
    }
    return query;
}

const ENTITY_STATE_INPROGRESS = "in progress";
const ENTITY_STATE_FAILED = "failed";

function composeQuery(query: IServiceQuery): string {
    query = ensureQuery(query);
    function _queryFilters(filters: IServiceFilters[]): string[] {
        return _.compact(_.values(_.map(filters, filter => {
            const value = _.get(filter, 'value');
            if (value) {
                return `q=${filter.key}${filter.op || eOperation.eq}${value}`;
            }
        })));
    }
    function _queryParams(object: any): string[] {
        return _.compact(_.map(_.keys(object), key => {
            const value = _.get(object, key);
            if (value) {
                return `${key}=${value}`;
            }
        }));
    }
    // a semicolon (;) serves as an "AND" operator between two query predicates in the value of the "q" query parameter
    return _.compact(_.concat(_queryFilters(query.filters).join(';'), _queryParams(_.omit(query, 'filters')))).join('&');
}

function waitForEntity(
    resolve: (value?: CFResource | PromiseLike<CFResource> | any) => void,
    reject: (reason?: any) => void,
    resource: CFResource,
    attempt: number,
    maxNumberOfAttemps: number,
    jobFunction: () => Promise<CFResource>,
    progress: ProgressHandler
) {
    if (attempt < maxNumberOfAttemps) {
        if (progress.cancelToken.isCancellationRequested) {
            reject(new Error(messages.create_service_canceled_by_requester));
        }
        const state = _.get(resource, "entity.last_operation.state");
        if (state === ENTITY_STATE_INPROGRESS) {
            progress.progress.report({ "message": `\n${messages.service_creation_started}`, increment: Math.floor(1 / maxNumberOfAttemps * 100) });
            setTimeout(() => {
                jobFunction().then(retriedResource => {
                    waitForEntity(resolve, reject, retriedResource, attempt + 1, maxNumberOfAttemps, jobFunction, progress);
                }).catch(error => {
                    reject(error);
                });
            }, 2000);
        } else if (state === ENTITY_STATE_FAILED) {
            reject(new Error(messages.failed_creating_entity(_.get(resource, "entity.last_operation.description"), getName(resource))));
        } else {
            progress.progress.report({ "message": `\n${messages.service_creation_started}`, increment: 100 });
            resolve(resource);
        }
    } else {
        resolve(messages.exceed_number_of_attempts(getName(resource)));
    }
}

async function execQuery(args: { query: string[]; options?: SpawnOptions; token?: CancellationToken }, fncParse?: (arg: any) => Promise<any>, reverseErrorOrder?: boolean): Promise<any> {
    const cliResult: CliResult = await Cli.execute(args.query, args.options, args.token);
    if (cliResult.exitCode !== 0) {
        throw new Error(reverseErrorOrder ?
            (cliResult.stdout || cliResult.stderr || cliResult.error) :
            (cliResult.error || cliResult.stderr || cliResult.stdout)
        );
    }
    return fncParse ? await fncParse(parse(cliResult.stdout)) : cliResult.stdout || cliResult.stderr;
}

async function execTotal(args: { query: string; options?: SpawnOptions; token?: CancellationToken }, fncParse?: (arg: any) => Promise<any>): Promise<any[]> {
    const collection: any = [];
    let query = args.query;
    while (query) {
        const result = parse(await execQuery({ query: ["curl", query], options: args.options, token: args.token }));
        for (const resource of _.get(result, "resources", [])) {
            collection.push(fncParse ? await fncParse(resource) : resource);
        }
        query = result.next_url;
    }
    return _.compact(collection);
}

function getCachedServiceInstanceLabel(service: any): Promise<string> {
    if (_.get(service, ['entity', 'service_url'])) {
        if (!cacheServiceInstanceTypes[service.entity.service_url]) {
            cacheServiceInstanceTypes[service.entity.service_url] = execQuery({ query: ["curl", service.entity.service_url] }, (data) => {
                return Promise.resolve(getLabel(data));
            }, true);
        }
        return cacheServiceInstanceTypes[service.entity.service_url];
    }
    return Promise.resolve('unknown');
}

/**
 * Fetch service instance by name from specified space_guid
 * @param query. Take care for encode the instance name in query parameter :  { key: eFilters.name, value: encodeURI(instanceName) }
 * @param token 
 */
async function getServiceInstance(query: IServiceQuery, token?: CancellationToken): Promise<CFResource> {
    const result = await execQuery({ query: ["curl", `/v2/service_instances?${composeQuery(query)}`], token }, (data: any) => data);
    if (_.size(_.get(result, 'resources')) === 1) {
        return _.head(result.resources);
    }
    throw new Error(messages.service_not_found(decodeURIComponent(_.get(_.find(query.filters, ['key', eFilters.name]), 'value')) || 'unknown'));
}

export async function cfCreateService(
    planGuid: string, instanceName: string, params: any, tags: string[], progress?: ProgressHandler, maxNumberOfAttemps?: number
): Promise<CFResource> {
    const spaceGuid: string = getSpaceFieldGUID(await cfGetConfigFileField("SpaceFields"));
    if (!spaceGuid) {
        throw new Error(messages.space_not_set);
    }

    maxNumberOfAttemps = _.isNil(maxNumberOfAttemps) ? 45 : maxNumberOfAttemps;
    progress = _.defaults(progress, { progress: { report: () => '' } }, { cancelToken: { isCancellationRequested: false, onCancellationRequested: () => '' } });
    const request = { name: instanceName, space_guid: spaceGuid, service_plan_guid: planGuid, parameters: params, tags };
    const result = await execQuery({ query: ["curl", "/v2/service_instances?accepts_incomplete=true", "-d", stringify(request), "-X", "POST"], token: progress.cancelToken });

    progress.progress.report({ "message": `\n${messages.service_creation_started}`, increment: 1 });

    const query = { filters: [{ key: eFilters.name, value: encodeURIComponent(instanceName) }, { key: eFilters.space_guid, value: spaceGuid }] };
    return new Promise<CFResource>((resolve, reject) => {
        waitForEntity(resolve, reject, parse(result), 0, maxNumberOfAttemps, () => getServiceInstance(query, progress.cancelToken), progress);
    });
}

export async function cfLogin(endpoint: string, user: string, pwd: string): Promise<string> {
    let result;
    try {
        result = await execQuery({ query: ["login", "-a", endpoint, "-u", user, "-p", pwd, "-o", "no-org-for-now", "-s", "no-space-for-now"], options: { env: { "CF_COLOR": "false" } } }, undefined, true);
    } catch (e) {
        result = _.get(e, 'message', '');
    }
    return result.includes(`Authenticating...${NEW_LINE}${OK}`) ? OK : result;
}

export async function cfGetAvailableOrgs(query?: IServiceQuery): Promise<any[]> {
    const params = composeQuery(query);
    return execTotal({ query: "/v2/organizations" + (params ? `?${params}` : "") }, (data: any) => {
        return Promise.resolve({ label: getName(data), guid: getGuid(data) });
    });
}

export async function cfGetAvailableSpaces(orgGuid?: string): Promise<any[]> {
    return execTotal({ query: orgGuid ? `/v2/organizations/${orgGuid}/spaces` : "/v2/spaces" }, (resource: any) => {
        return Promise.resolve({
            label: getName(resource),
            guid: getGuid(resource),
            orgGUID: getOrgGUID(resource)
        });
    });
}

export async function cfGetServiceInstances(query?: IServiceQuery, token?: CancellationToken): Promise<ServiceInstanceInfo[]> {
    const serviceNames: Promise<string>[] = [];
    const collection = await execTotal({ query: `v2/service_instances?${composeQuery(await padQuerySpace(query))}`, token }, (info: any): Promise<unknown> => {
        const promise = getCachedServiceInstanceLabel(info);
        serviceNames.push(promise);
        return Promise.resolve({ "label": getName(info), "serviceName": promise, plan_guid: _.get(info, "entity.service_plan_guid"), tags: getTags(info), credentials: getCredentials(info) });
    });

    if(!_.size(serviceNames)) { // sapjira issue DEVXBUGS-7773
        return [];
    }
   
    return Promise.race(serviceNames).then(async () => {
        const instances: ServiceInstanceInfo[] = [];        
        for (const instance of collection) {
            let serviceName: string;
            try {
                serviceName = await _.get(instance, 'serviceName');
            } catch (e) {
                serviceName = 'unknown';
            }
            instances.push({
                label: _.get(instance, 'label'),
                serviceName: serviceName,
                plan_guid: _.get(instance, 'plan_guid'),
                tags: _.get(instance, 'tags'),
                credentials: _.get(instance, 'credentials')
            });
        }
        return _.compact(instances);
    });
}

export async function cfSetOrgSpace(org: string, space?: string): Promise<void> {
    await execQuery({ query: _.concat(["target", "-o", org], (space ? ["-s", space] : [])) });
    clearCacheServiceInstances();
    cfGetServiceInstances();
}

export async function cfGetTargets(): Promise<CFTarget[]> {
    const targets = await execQuery({ query: ["targets"] });

    if (_.includes(targets, "No targets have been saved yet") || _.includes(targets, "is not a registered command")) {
        // no targets yet.
        return [{ label: DEFAULT_TARGET, isCurrent: true, isDirty: false }];
    }

    const targetSubstrings = _.compact(_.map(targets.split(NEW_LINE), targetSubstring => targetSubstring.trim()));
    return _.map(targetSubstrings, targetSubstring => {
        const parentthesisPos = targetSubstring.indexOf("(current");
        if (parentthesisPos > 0) {
            targetSubstring = targetSubstring.substring(0, parentthesisPos);
            return { label: targetSubstring.trim(), isCurrent: true, isDirty: targetSubstring.includes("modified") };
        }

        return { label: targetSubstring, isCurrent: false, isDirty: false };
    });
}

/**
 * Returning User-provided-services instances
 * 
 * @param query: IServiceQuery (optional)
 * @param token : CancellationToken (optional)
 */
export async function cfGetUpsInstances(query?: IServiceQuery, token?: CancellationToken): Promise<ServiceInstanceInfo[]> {
    return execTotal({ query: `v2/user_provided_service_instances?${composeQuery(await padQuerySpace(query))}`, token }, (info: any): Promise<ServiceInstanceInfo> => {
        return Promise.resolve({ label: getName(info), serviceName: _.get(info, "entity.type"), tags: getTags(info), credentials: getCredentials(info) });
    });
}

function getServices(url: string, query: IServiceQuery, cancellationToken: CancellationToken): PromiseLike<ServiceInfo[]> {
    return execTotal({ query: `${url}?${composeQuery(query)}`, token: cancellationToken }, (service: any) => {
        return Promise.resolve({
            label: getLabel(service),
            service_plans_url: _.get(service, "entity.service_plans_url"),
            guid: getGuid(service),
            description: getDescription(service)
        });
    });
}

export async function cfGetSpaceServices(query?: IServiceQuery, cancellationToken?: CancellationToken): Promise<ServiceInfo[]> {
    // https://apidocs.cloudfoundry.org/200/spaces/list_all_services_for_the_space.html
    const spaceGUID = (await padQuerySpace({})).filters[0].value;
    const url = `/v2/spaces/${spaceGUID}/services`;
    return getServices(url, query, cancellationToken);
}

export async function cfGetServices(query?: IServiceQuery, cancellationToken?: CancellationToken): Promise<ServiceInfo[]> {    
    return getServices("/v2/services", query, cancellationToken);
}

export async function cfGetServicePlans(servicePlansUrl: string): Promise<PlanInfo[]> {
    return execTotal({ query: servicePlansUrl }, (data: any) => {
        return Promise.resolve({ label: getName(data), guid: getGuid(data), description: getDescription(data) });
    });
}

export async function cfGetServicePlansList(query?: IServiceQuery, token?: CancellationToken): Promise<PlanInfo[]> {
    return execTotal({ query: `/v2/service_plans?${composeQuery(query)}`, token }, (data: any) => {
        return Promise.resolve({ label: getName(data), guid: getGuid(data), description: getDescription(data) });
    });
}

/**
 * * Example of usage : cf bind-local -path .env -service-names serviceName1 serviceName2 -service-keys serviceKeys1 serviceKeys2 -tags tagsValue1 tagsValue2 -params {\"permissions\":[\"development\"]}
 * 
 * @param filePath : string
 * @param instanceNames : string[]
 * @param tags : string[] (Optional)
 * @param serviceKeyNames : string[] (Optional)
 * @param serviceKeyParams : any[] (Optional) Example: {"pemissions":["development"]}
 */
export async function cfBindLocalServices(filePath: string, instanceNames: string[], tags?: string[], serviceKeyNames?: string[], serviceKeyParams?: unknown[]): Promise<void> {
    await execQuery({
        query: [
            "bind-local",
            "-path",
            filePath,
            "-service-names",
            ..._.map(instanceNames, encodeURI),
            ...(_.size(tags) ? _.concat(["-tags"], tags) : []),
            ...(_.size(serviceKeyNames) ? _.concat(["-service-keys"], serviceKeyNames) : []),
            ...(_.size(serviceKeyParams) ? _.concat(["-params"], _.map(serviceKeyParams, param => { return stringify(param); })) : [])
        ]
    });
}

/**
 * Example of usage : cf bind-local-ups -path .env -service-names serviceNamesValue1 -service-names serviceNamesvalue2 -tags tagsValue1 -tags tagsValue2
 * 
 * @param filePath : string
 * @param instanceNames : string[]
 * @param tags : string[]
 */
export async function cfBindLocalUps(filePath: string, instanceNames: string[], tags?: string[]): Promise<void> {
    await execQuery({
        query: _.concat(
            ["bind-local-ups", "-path", filePath],
            _.reduce(instanceNames, (result, instanceName) => {
                result = _.concat(result, [`-service-names`, `${encodeURI(instanceName)}`]);
                return result;
            }, []),
            _.reduce(tags, (result, tag) => {
                result = _.concat(result, [`-tags`, `${tag}`]);
                return result;
            }, [])
        )
    });
}

/**
 * List all Service Keys
 * @param query 
 * @param token (optional) ability to cancel operaton
 */
export async function cfGetServiceKeys(query?: IServiceQuery, token?: CancellationToken): Promise<any[]> {
    if (_.isEmpty(_.intersection([eFilters.name, eFilters.service_instance_guid], _.map(_.get(query, 'filters'), 'key')))) {
        throw new Error(messages.no_valid_filters);
    }
    return execTotal({ query: `v2/service_keys?${composeQuery(query)}`, token });
}

export async function cfGetInstanceCredentials(query?: IServiceQuery, token?: CancellationToken): Promise<any[]> {
    return _.compact(_.map(await cfGetServiceKeys(query, token), 'entity.credentials'));
}

export async function cfGetInstanceMetadata(instanceName: string): Promise<any> {
    const instance = await getServiceInstance(await padQuerySpace({ filters: [{ key: eFilters.name, value: encodeURIComponent(instanceName) }] }));
    const plans = await cfGetServicePlansList({
        filters: [
            { key: eFilters.service_guid, value: _.get(instance, ['entiry', 'service_guid']) },
            { key: eFilters.service_instance_guid, value: _.get(instance, ['metadata', 'guid']) }
        ]
    });
    let serviceName: string;
    try {
        serviceName = await getCachedServiceInstanceLabel(instance);
    } catch (e) {
        serviceName = 'unknown';
    }
    return {
        serviceName: _.get(instance, ['entity', 'name']),
        plan: _.head(plans).label,
        plan_guid: _.get(instance, ['entity', 'service_plan_guid']),
        service: serviceName
    };
}

export async function cfGetAuthToken(): Promise<string> {
    return await execQuery({ query: ["oauth-token"] });
}

export async function cfGetTarget(weak?: boolean): Promise<ITarget> {
    if (!weak) {
        await cfGetAuthToken();
    }
    const data = await execQuery({ query: ["target"], options: { env: { "CF_COLOR": "false" } } });
    const result: any = {};
    _.each(_.compact(_.split(data, '\n')), item => {
        item = _.replace(_.trim(item), /^['"]|['"]$/g, '');
        const sep = _.indexOf(item, ':');
        if (sep > -1) {
            result[`${_.trim(_.join(_.slice(item, 0, sep), ''))}`] = _.trim(_.join(_.slice(item, sep + 1), ''));
        }
    });
    return result;
}

export async function cfLogout() {
    await execQuery({ query: ["logout"] });
}

export async function cfCreateUpsInstance(info: UpsTypeInfo): Promise<CFResource> {
    const data = { "name": info.instanceName };
    let spaceGuid: string = info.space_guid;
    if (!spaceGuid) {
        spaceGuid = getSpaceFieldGUID(await cfGetConfigFileField("SpaceFields"));
        if (!spaceGuid) {
            throw new Error(messages.space_not_set);
        }
    }
    _.merge(data,
        { "space_guid": spaceGuid },
        info.credentials ? { "credentials": info.credentials } : {},
        info.route_service_url ? { "route_service_url": info.route_service_url } : {},
        info.syslog_drain_url ? { "syslog_drain_url": info.syslog_drain_url } : {},
        info.tags ? { "tags": info.tags } : {}
    );
    return parse(await execQuery({ query: ["curl", `/v2/user_provided_service_instances`, '-d', stringify(data), "-X", "POST"] }));
}

export async function cfGetInstanceKeyParameters(instanceName: string): Promise<any | undefined> {
    let query = { filters: [{ key: eFilters.name, value: encodeURIComponent(instanceName) }] };
    const collection = await execTotal({ query: `v2/service_instances?${composeQuery(await padQuerySpace(query))}` });
    if (!_.size(collection)) {
        return undefined; // service instance not found
    }
    query = { filters: [{ key: eFilters.service_instance_guid, value: _.get(collection, ["0", "metadata", "guid"]) }] };
    let keys = await cfGetServiceKeys(query);
    if (!_.size(keys)) {
        await Cli.execute(["create-service-key", encodeURIComponent(instanceName), "key"]);
        query.filters.push({ key: eFilters.name, value: "key" });
        keys = await cfGetServiceKeys(query);
    }
    return _.get(keys, ["0", "entity", "credentials"]);
} 
