/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as _ from "lodash";
import * as os from "os";
import * as fsextra from "fs-extra";
import { IServiceQuery, CF_PAGE_SIZE } from "./types";

export async function dataContentAsObject(filePath: string) {
    try {
        return _.reduce(_.split(await fsextra.readFile(filePath, "utf8"), os.EOL), (data: any, line: string) => {
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

export function assureQuery(query: IServiceQuery): IServiceQuery {
    query = query || {};
    _.defaults(query, { filters: [] });
    // default paging size is 50...
    _.defaults(query, { 'results-per-page': CF_PAGE_SIZE });
    return query;
}
