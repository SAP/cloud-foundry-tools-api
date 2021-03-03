import { Cli } from "./cli";
import * as _ from "lodash";
import { eFilters, ServiceInstanceInfo } from "./types";
import { cfGetInstanceMetadata, cfGetTarget, cfGetServices, cfGetInstanceKeyParameters, cfGetManagedServiceInstances } from "./cf-local";
import { padQuerySpace } from "./utils";

export async function getServicesInstancesFilteredByType(serviceTypes: string[]): Promise<ServiceInstanceInfo[]> {
    const services = await cfGetServices(await padQuerySpace({ 'filters': [{ key: eFilters.names, value: _.join(_.map(serviceTypes, encodeURIComponent)) }] }));
    return _.size(services) ? cfGetManagedServiceInstances({
        'filters': [{ key: eFilters.service_offering_guids, value: _.join(_.map(services, 'guid')) }]
    }) : [];
}

/**
 * @deprecated use cfGetInstanceKeyParameters instead of
 */
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

/**
 * @deprecated : use cfGetInstanceMetadata instead of
 */
export function getInstanceMetadata(instanceName: string): Promise<any> {
    return cfGetInstanceMetadata(instanceName);
}

export async function isTargetSet(): Promise<boolean> {
    const target = await cfGetTarget();
    return !_.isEmpty(target.org) && !_.isEmpty(target.space);
}
