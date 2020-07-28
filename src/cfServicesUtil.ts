/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cli } from "./cli";
import * as _ from "lodash";
import { ServiceInstanceInfo, ServiceKey } from "./types";
import { cfGetServiceInstances, cfGetInstanceMetadata, cfGetTarget } from "./cf-local";

export async function getServicesInstancesFilteredByType(serviceTypes: string[]): Promise<ServiceInstanceInfo[]> {
    const serviceInstances = await cfGetServiceInstances();
    return serviceInstances.filter(service => serviceTypes.includes(service.serviceName));
}

export async function getInstanceCredentials(instanceName: string): Promise<ServiceKey> {
    await Cli.execute(["create-service-key", instanceName, "key"]);
    const serviceCredentials = await Cli.execute(["service-key", instanceName, "key"]);
    let res = serviceCredentials.stdout;
    res = res.substr(res.indexOf("{"));
    return JSON.parse(res);
}

export async function createServiceInstance(serviceType: string, servicePlan: string, serviceInstanceName: string,
    config?: any): Promise<any> {
    let args = ["create-service", serviceType, servicePlan, serviceInstanceName];
    if (config) {
        args = args.concat(["-c", config]);
    }
    return Cli.execute(args);
}

export async function getInstanceMetadata(instanceName: string): Promise<any> {
    return cfGetInstanceMetadata(instanceName);
}

export async function isTargetSet(): Promise<boolean> {
    const target = await cfGetTarget();
    return !_.isNil(target.org) && !_.isNil(target.space);
}
