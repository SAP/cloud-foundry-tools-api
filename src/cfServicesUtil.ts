/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cli } from "./cli";
import * as _ from "lodash";
import { eFilters, eOperation, ServiceInstanceInfo } from "./types";
import { cfGetServiceInstances, cfGetInstanceMetadata, cfGetTarget, cfGetServices, cfGetServicePlans, cfGetInstanceKeyParameters } from "./cf-local";

async function getServicePlansGuidList(serviceTypes: string[]): Promise<string[]> {
    return _.map(_.flatten(await Promise.all(
        _.map(await cfGetServices({ 'filters': [{ key: eFilters.label, value: _.join(_.map(serviceTypes, encodeURIComponent)), op: eOperation.IN }] }), service => {
            return cfGetServicePlans(service.service_plans_url);
        })
    )), 'guid');
}

export async function getServicesInstancesFilteredByType(serviceTypes: string[]): Promise<ServiceInstanceInfo[]> {
    return _.filter(
        await cfGetServiceInstances({ 'filters': [{ key: eFilters.service_plan_guid, value: _.join(await getServicePlansGuidList(serviceTypes)), op: eOperation.IN }] }),
        (service => { return _.includes(serviceTypes, service.serviceName); })
    );
}

export function getInstanceCredentials(instanceName: string): Promise<any> {
    return cfGetInstanceKeyParameters(instanceName);
}

export function createServiceInstance(serviceType: string, servicePlan: string, serviceInstanceName: string,
    config?: any): Promise<any> {
    let args = ["create-service", serviceType, servicePlan, serviceInstanceName];
    if (config) {
        args = args.concat(["-c", config]);
    }
    return Cli.execute(args);
}

export function getInstanceMetadata(instanceName: string): Promise<any> {
    return cfGetInstanceMetadata(instanceName);
}

export async function isTargetSet(): Promise<boolean> {
    const target = await cfGetTarget();
    return !_.isEmpty(target.org) && !_.isEmpty(target.space);
}
