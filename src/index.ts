/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './types';
export * from './cli';
export * from './cf-local';
export * from './messages';
export * from './utils';

import { ServiceKey, ServiceInstanceInfo } from './types';
import * as serviceUtils from './cfServicesUtil';

export async function apiGetServicesInstancesFilteredByType(serviceTypes: string[]): Promise<ServiceInstanceInfo[]> {
    return serviceUtils.getServicesInstancesFilteredByType(serviceTypes);
}

export async function apiGetInstanceCredentials(instanceName: string): Promise<ServiceKey> {
    return serviceUtils.getInstanceCredentials(instanceName);
}

export async function apiCreateServiceInstance(serviceType: string, servicePlan: string, instanceName: string, config?: any) {
    return serviceUtils.createServiceInstance(serviceType, servicePlan, instanceName, config);
}

export async function apiGetInstanceMetadata(instanceName: string): Promise<any> {
    return serviceUtils.getInstanceMetadata(instanceName);
}
