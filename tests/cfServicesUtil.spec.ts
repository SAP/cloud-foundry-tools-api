/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as _ from "lodash";
import * as sinon from "sinon";
import * as fsextra from "fs-extra";
import * as cfLocal from "../src/cf-local";
import { ServiceInstanceInfo, ITarget, CliResult, ServiceInfo, eFilters, eOperation, PlanInfo } from "../src/types";
import * as cli from "../src/cli";
import { getServicesInstancesFilteredByType, getInstanceMetadata, isTargetSet, getInstanceCredentials, createServiceInstance } from "../src/cfServicesUtil";
import { expect, assert } from "chai";
import { fail } from "assert";

describe('services unit package tests', () => {
    let sandbox: any;
    let mockCfLocal: any;
    let mockCli: any;
    let fsExtraMock: any;

    before(() => {
        sandbox = sinon.createSandbox();
    });

    after(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        mockCfLocal = sandbox.mock(cfLocal);
        mockCli = sandbox.mock(cli.Cli);
        fsExtraMock = sandbox.mock(fsextra);
    });

    afterEach(() => {
        mockCfLocal.verify();
        mockCli.verify();
        fsExtraMock.verify();
    });

    describe("getServicesInstancesFilteredByType", () => {
        const types = ['saas-registry', 'audolog'];
        const services: ServiceInfo[] = [{
            description: 'description1',
            guid: 'd2ff128b-e1a8-15f7-828a-24be6173db7b',
            label: types[0],
            service_plans_url: '/v2/services/d2ff128b-A1a8-45f7-828a-24be6173db7b/service_plans'
        }, {
            description: 'description2',
            guid: 'd2ff128b-e2a8-25f7-828a-24be6173db7b',
            label: types[1],
            service_plans_url: '/v2/services/d2ff128b-s1a8-45f7-828a-24be6173db7b/service_plans'
        }];
        const plans: Promise<PlanInfo[]>[] = [
            Promise.resolve([{ label: 'abap', guid: 'abap_guid', description: 'abap_description' }, { label: 'abap_cloud', guid: 'abap_cloud_guid', description: 'abap_cloud_description' }]),
            Promise.resolve([{ label: 'abap_db', guid: 'abap_db_guid', description: 'abap_db_description' }])
        ];
        const instances: ServiceInstanceInfo[] = [{ label: "label1", serviceName: types[1] }, { label: "label2", serviceName: "service1" }, { label: "label3", serviceName: types[0] }];

        it("ok", async () => {
            const query = { 'filters': [{ key: eFilters.label, value: _.join(_.map(types, encodeURIComponent)), op: eOperation.IN }] };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves(services);
            mockCfLocal.expects("cfGetServicePlans").withExactArgs(services[0].service_plans_url).resolves(plans);
            mockCfLocal.expects("cfGetServicePlans").withExactArgs(services[1].service_plans_url).resolves(plans);
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            assert.deepEqual(_.map(await getServicesInstancesFilteredByType(types), 'label'), [instances[0].label, instances[2].label]);
        });

        it("nothing match", async () => {
            const query = { 'filters': [{ key: eFilters.label, value: _.join(_.map(['service3', 'serviceAny'], encodeURIComponent)), op: eOperation.IN }] };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves([]);
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            expect(_.size(await getServicesInstancesFilteredByType(['service3', 'serviceAny']))).to.be.equal(0);
        });

        it("undefined types", async () => {
            const query = { 'filters': [{ key: eFilters.label, value: _.join(_.map(null, encodeURIComponent)), op: eOperation.IN }] };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves([]);
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            expect(_.size(await getServicesInstancesFilteredByType(null))).to.be.equal(0);
        });

        it("thrown exception", async () => {
            const query = { 'filters': [{ key: eFilters.label, value: _.join(_.map(['filter'], encodeURIComponent)), op: eOperation.IN }] };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves([]);
            const error = new Error("cfGetServiceInstances failed");
            mockCfLocal.expects("cfGetServiceInstances").throws(error);
            try {
                await getServicesInstancesFilteredByType(['filter']);
                fail("should fail");
            } catch (e) {
                expect(e.message).to.be.equal(error.message);
            }
        });
    });

    describe("getInstanceMetadata", () => {

        it("ok", async () => {
            const name = "someInstance";
            mockCfLocal.expects("cfGetInstanceMetadata").withExactArgs(name).resolves();
            await getInstanceMetadata(name);
        });

        it("undefined requested name", async () => {
            const name: string = null;
            mockCfLocal.expects("cfGetInstanceMetadata").withExactArgs(name).resolves();
            await getInstanceMetadata(name);
        });

        it("thrown exception", async () => {
            const error = new Error("cfGetInstanceMetadata failed");
            mockCfLocal.expects("cfGetInstanceMetadata").throws(error);
            try {
                await getInstanceMetadata('filter');
                fail("should fail");
            } catch (e) {
                expect(e.message).to.be.equal(error.message);
            }
        });

    });

    describe("isTargetSet", () => {

        const result: ITarget = {
            "api endpoint": "endPoint",
            "api version": "v. 2.01",
            "user": "bag023"
        };

        it("setted up target", async () => {
            result.org = "org";
            result.space = "space";
            mockCfLocal.expects("cfGetTarget").resolves(result);
            expect(await isTargetSet()).to.be.equal(true);
        });

        it("space set, org - not", async () => {
            result.org = "";
            result.space = "space";
            mockCfLocal.expects("cfGetTarget").resolves(result);
            expect(await isTargetSet()).to.be.equal(false);
        });

        it("space - not set, org - set", async () => {
            result.org = "org";
            result.space = undefined;
            mockCfLocal.expects("cfGetTarget").resolves(result);
            expect(await isTargetSet()).to.be.equal(false);
        });

        it("thrown exception", async () => {
            const error = new Error("cfGetTarget failed");
            mockCfLocal.expects("cfGetTarget").throws(error);
            try {
                await isTargetSet();
                fail("should fail");
            } catch (e) {
                expect(e.message).to.be.equal(error.message);
            }
        });

    });

    describe("getInstanceCredentials", () => {

        const instanceName = 'myService';
        const result: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        result.stdout = `{
            "resources": [{
                "metadata": {
                    "url": "/v2/service_instances/a6caf36f-2523-401f-aed1-b25ed6a7c2d9"
                },
                "entity": {
                    "name": "test",
                    "credentials" : {
                        "apiurl": "https://api.authentication.sap.hana.ondemand.com",
                        "clientid": "clientid",
                        "sburl": "https://ondemand.com",
                        "tenantmode": "mode",
                        "url": "https://ondemand.com",
                        "xsappname": "xsuaa_1595943223466!t192"
                    }
                }
            }]
        }`;

        it("ok", async () => {
            const cliResult: CliResult = {
                stdout: "",
                stderr: "",
                exitCode: 0
            };
            const iGuid = "a6caf36f-2523-401f-aed1-b25ed6a7c2d9";
            cliResult.stdout = `{
                "resources": [{
                    "metadata": {
                        "guid": "${iGuid}",
                        "url": "/v2/service_instances/a6caf36f-2523-401f-aed1-b25ed6a7c2d9"
                    },
                    "entity": {
                        "name": "test"
                    }
                }]
            }`;
            const spaceGuid = "testSpaceGUID";
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_instances?q=name:${encodeURIComponent(instanceName)};q=space_guid:${spaceGuid}&results-per-page=297`], undefined, undefined).resolves(cliResult);
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_keys?q=service_instance_guid:${iGuid}&results-per-page=297`], undefined, undefined).resolves(result);
            const credentials = await getInstanceCredentials(instanceName);
            assert.deepEqual(credentials, JSON.parse(result.stdout).resources[0].entity.credentials);
        });

        it("service instance not found", async () => {
            const cliResult: CliResult = {
                stdout: `{ "resources": [] }`,
                stderr: "",
                exitCode: 0
            };
            const spaceGuid = "testSpaceGUID";
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_instances?q=name:${encodeURIComponent(instanceName)};q=space_guid:${spaceGuid}&results-per-page=297`], undefined, undefined).resolves(cliResult);
            expect(await getInstanceCredentials(instanceName)).to.be.undefined;
        });

        it("no keys - create one", async () => {
            const cliResult: CliResult = {
                stdout: "",
                stderr: "",
                exitCode: 0
            };
            const iGuid = "a6caf36f-2523-401f-aed1-b25ed6a7c2d9";
            cliResult.stdout = `{
                "resources": [{
                    "metadata": {
                        "guid": "${iGuid}",
                        "url": "/v2/service_instances/a6caf36f-2523-401f-aed1-b25ed6a7c2d9"
                    },
                    "entity": {
                        "name": "test"
                    }
                }]
            }`;
            const spaceGuid = "testSpaceGUID";
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_instances?q=name:${encodeURIComponent(instanceName)};q=space_guid:${spaceGuid}&results-per-page=297`], undefined, undefined).resolves(cliResult);
            const keysResult: CliResult = {
                stdout: `{ "resources": [] }`,
                stderr: "",
                exitCode: 0
            };
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_keys?q=service_instance_guid:${iGuid}&results-per-page=297`], undefined, undefined).resolves(keysResult);
            mockCli.expects("execute").withExactArgs(["create-service-key", encodeURIComponent(instanceName), 'key']).resolves();
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_keys?q=service_instance_guid:${iGuid};q=name:key&results-per-page=297`], undefined, undefined).resolves(result);
            const credentials = await getInstanceCredentials(instanceName);
            assert.deepEqual(credentials, JSON.parse(result.stdout).resources[0].entity.credentials);
        });

        it("thrown exception", async () => {
            const cliResult: CliResult = {
                stdout: "",
                stderr: "",
                exitCode: 0
            };
            const iGuid = "a6caf36f-2523-401f-aed1-b25ed6a7c2d9";
            cliResult.stdout = `{
                "resources": [{
                    "metadata": {
                        "guid": "${iGuid}",
                        "url": "/v2/service_instances/a6caf36f-2523-401f-aed1-b25ed6a7c2d9"
                    },
                    "entity": {
                        "name": "test"
                    }
                }]
            }`;
            const spaceGuid = "testSpaceGUID";
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_instances?q=name:${encodeURIComponent(instanceName)};q=space_guid:${spaceGuid}&results-per-page=297`], undefined, undefined).resolves(cliResult);
            const keysResult: CliResult = {
                stdout: `{ "resources": [] }`,
                stderr: "",
                exitCode: 0
            };
            mockCli.expects("execute").withExactArgs(['curl', `v2/service_keys?q=service_instance_guid:${iGuid}&results-per-page=297`], undefined, undefined).resolves(keysResult);
            const error = new Error("cfGetTarget failed");
            mockCli.expects("execute").withExactArgs(["create-service-key", encodeURIComponent(instanceName), 'key']).throws(error);
            try {
                await getInstanceCredentials(instanceName);
            } catch (e) {
                expect(e.message).to.be.equal(error.message);
            }
        });
    });

    describe("createServiceInstance", () => {

        const type = 'serviceType';
        const instanceName = "instanceName";
        const plan = 'servicePlan';
        const config = { data: 'some' };

        it("ok", async () => {
            mockCli.expects("execute").withExactArgs(["create-service", type, plan, instanceName, "-c", config]).resolves();
            await createServiceInstance(type, plan, instanceName, config);
        });

        it("ok - without config", async () => {
            mockCli.expects("execute").withExactArgs(["create-service", type, plan, instanceName]).resolves();
            await createServiceInstance(type, plan, instanceName);
        });

    });
});
