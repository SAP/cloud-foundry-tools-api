/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as _ from "lodash";
import * as os from "os";
import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "comment-json";
import { messages } from "./messages";
import { IServiceQuery, CF_PAGE_SIZE, IServiceFilters, eFilters, eServiceTypes } from "./types";

export async function dataContentAsObject(filePath: string) {
    try {
        return _.reduce(_.split(await fs.readFile(filePath, { encoding: "utf8" }), os.EOL), (data: any, line: string) => {
            const parts = _.split(line, '=');
            if (_.size(parts) > 1) {
                data[_.trim(parts[0])] = _.trim(parts[1]);
            }
            return data;
        }, {});
    } catch (error) {
        // log error
        return {};
    }
}

export function ensureQuery(query?: IServiceQuery): IServiceQuery {
    query = query || {};
    _.defaults(query, { filters: [] });
    // default paging size is 50...
    _.defaults(query, { per_page: CF_PAGE_SIZE });
    return query;
}

export function padQuery(query: IServiceQuery, otherFilters: IServiceFilters[]): IServiceQuery {
    query = ensureQuery(query);
    _.each(otherFilters, other => {
        const filter = _.find(query.filters, ['key', other.key]);
        if (!_.size(filter?.value)) {
            query.filters = _.concat(query.filters, [other]);
        }
    });
    return query;
}

export function getGuid(resource: any): string {
    return _.get(resource, "guid", '');
}

export function getName(resource: any): string {
    return _.get(resource, "name", '');
}

export function getLabel(resource: any): string {
    return _.get(resource, "label", '');
}

export function getDescription(resource: any): string {
    return _.get(resource, "description", '');
}

export function getSpaceFieldGUID(spaceField: any): string {
    return _.get(spaceField, "GUID", '');
}

export function getOrgGUID(resource: any): string {
    return _.get(resource, ["relationships", "organization", "data", "guid"], '');
}

export function getTags(resource: any): string[] {
    return _.get(resource, "tags", []);
}

export function cfGetConfigFilePath(): string {
    return path.join(_.get(process, "env.CF_HOME", os.homedir()), ".cf", "config.json");
}

export function isUpsType(resource: any): boolean {
    return _.get(resource, "type", eServiceTypes.managed) === eServiceTypes.user_provided;
}

export async function cfGetConfigFileField(field: string): Promise<any> {
    try {
        const configJson = parse(await fs.readFile(cfGetConfigFilePath(), { encoding: "utf8" }));
        return _.get(configJson, `${field}`);
    } catch (error) {
        // empty or non existing file
    }
}

export async function getSpaceGuidThrowIfUndefined(): Promise<string> {
    const space: string = getSpaceFieldGUID(await cfGetConfigFileField("SpaceFields"));
    if (!space) {
        throw new Error(messages.cf_setting_not_set);
    }
    return space;
}

export async function padQuerySpace(query: IServiceQuery, otherFilters?: IServiceFilters[]): Promise<IServiceQuery> {
    query = padQuery(query, otherFilters);
    const filter = _.find(query.filters, ['key', eFilters.space_guids]);
    if (!_.size(filter?.value)) {
        query.filters = _.concat(query.filters, [{ key: eFilters.space_guids, value: await getSpaceGuidThrowIfUndefined() }]);
    }
    return query;
}
