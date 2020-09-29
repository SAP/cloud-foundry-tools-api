/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const OK = "OK";
export const NEW_LINE = "\n";

export const CF_PAGE_SIZE = 99 * 3;
export const DEFAULT_TARGET = "Default (no targets)";

export interface CliResult {
    stdout: string;
    stderr: string;
    error?: string;
    exitCode: number;
}

export enum CF_CMD_EXIT_CODE {
    OK = 0,
    ERROR = -1,
    CANCEL_REQ = -2,
    CANCELED = -3
}

export interface CancellationToken {
    /**
     * Is `true` when the token has been cancelled, `false` otherwise.
     */
    isCancellationRequested: boolean;
    /**
     * An [event](#Event) which fires upon cancellation.
     */
    onCancellationRequested: any;
}

interface Progress<T> {
    /**
     * Report a progress update.
     * @param value A progress item, like a message and/or an
     * report on how much work finished
     */
    report(value: T): void;
}

export interface ProgressHandler {
    progress: Progress<{ message?: string; increment?: number }>;
    cancelToken: CancellationToken;
}

export interface CFTarget {
    label: string;
    isCurrent: boolean;
    isDirty: boolean;
}

export interface ServiceInstanceInfo {
    label: string;
    serviceName: string;
    tags?: string[];
    alwaysShow?: boolean;
    plan_guid?: string;
    credentials?: any;
}

export interface ServiceInfo {
    label: string;
    guid: string;
    service_plans_url: string;
    description: string;
}

export interface PlanInfo {
    label: string;
    guid: string;
    description: string;
}

export interface CFResource {
    metadata: any;
    entity: any;
}

export interface ServiceTypeInfo {
    name: string;   // uses to filter the display of instances by service type: 'hana', 'xsuaa' and etc.
    plan: string;   // uses to filter the display of instances by plan name: 'application', 'lite' and etc. can be single name or regex expression
    tag: string;    // tag attribute name that will glued for service instance in .env (not relevant for ups)
    prompt: string; // displaying prompt title on select service instances quick pick
    plans?: PlanInfo[]; // internal 
    serviceKeyName?: string;    // service key attribute name that will glued for service instance in .env (not relevant for ups)
    serviceKeyParam?: any;  // arbitrary params in json format to be glued to service-key during 'bind-local'
    ups?: {                 // user-provided-services section
        tag?: string;       // uses to filter the display of user-provided-services by tag. can be sigle name or regex expression ('/[hana|monodb]/')
        isShow?: boolean;   // force to fetch ups instances
    }; 
    allowCreate?: {         // allow creation a new service instance during binding
        name?: string;          // default allocated name for creating service instance
        namePrompt?: string;    // prompt for service instance name creation quik pick
        params?: any;           // arbitrary params in json format for service instance creation
    };
}

export enum eFilters {
    name = 'name',
    space_guid = 'space_guid',
    service_plan_guid = 'service_plan_guid',
    service_binding_guid = 'service_binding_guid',
    gateway_name = 'gateway_name',
    organization_guid = 'organization_guid',
    service_key_guid = 'service_key_guid',
    service_guid = 'service_guid',
    service_instance_guid = 'service_instance_guid',
    user_guid = 'user_guid',
    manager_guid = 'manager_guid',
    billing_manager_guid = 'billing_manager_guid',
    auditor_guid = 'auditor_guid',
    status = 'status'
}

export enum eOperation {
    eq = ':', be = '>=', le = '<=', l = '<', b = '>', IN = '%20IN%20'
}
export interface IServiceFilters { // eslint-disable-line @typescript-eslint/interface-name-prefix
    key: eFilters;
    value: string;
    op?: eOperation;
}

export enum eOrderDirection { asc, desc }

export interface IServiceQuery { // eslint-disable-line @typescript-eslint/interface-name-prefix
    filters?: IServiceFilters[];
    'results-per-page'?: number;
    page?: number;
    'order-direction'?: eOrderDirection;
}

export interface ServiceBinding {
    env: string;
    id: string;
    type: string;
    version: string;
}

export interface UAAInfo {
    apiurl: string;
    clientid: string;
    clientsecret: string;
    identityzone: string;
    identityzoneid: string;
    sburl: string;
    tenantid: string;
    tenantmode: string;
    uaadomain: string;
    url: string;
    verificationkey: string;
    xsappname: string;
}

export interface ServiceKey {
    binding: ServiceBinding;
    catalogs: any;
    endpoints: any;
    preserve_host_header: boolean;
    "sap.cloud.service": string;
    systemid: string;
    uaa: UAAInfo;
    url: string;
}

export interface ITarget { // eslint-disable-line @typescript-eslint/interface-name-prefix
    'api endpoint': string;
    'api version': string;
    user: string;
    org?: string;
    space?: string;
}

export interface UpsTypeInfo {
    instanceName: string;
    space_guid?: string;
    syslog_drain_url?: string;
    credentials?: unknown;
    route_service_url?: string;
    tags?: string[];
}