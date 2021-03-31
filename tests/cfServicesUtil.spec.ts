/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as _ from "lodash";
import * as sinon from "sinon";
import * as fsextra from "fs-extra";
import * as cfLocal from "../src/cf-local";
import { ITarget, ServiceInfo, ServiceInstanceInfo, eFilters, CF_PAGE_SIZE } from "../src/types";
import * as cli from "../src/cli";
import { getInstanceMetadata, isTargetSet, getInstanceCredentials, createServiceInstance, getServicesInstancesFilteredByType } from "../src/cfServicesUtil";
import { expect, assert } from "chai";
import { fail } from "assert";
import { cfGetConfigFilePath } from "../src/utils";

describe('services unit package tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockCfLocal: sinon.SinonMock;
    let mockCli: sinon.SinonMock;
    let fsExtraMock: sinon.SinonMock;

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
        const spaceGuid = 'space-d2ff128b-e2a8-25f7-828a-24be6173db7b';

        beforeEach(() => {
            fsExtraMock.expects("readFile").withExactArgs(cfGetConfigFilePath(), "utf8").resolves(`{"SpaceFields": {
                "GUID": "${spaceGuid}"
            }}`);
        });

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
        const instances: ServiceInstanceInfo[] = [{ label: "label1", serviceName: types[1] }, { label: "label3", serviceName: types[0] }];
        const query = { 'filters': [{ key: eFilters.names, value: _.join(_.map(types, encodeURIComponent)) }, { key: eFilters.space_guids, value: spaceGuid }], per_page: CF_PAGE_SIZE };

        it("ok:: verify query parameters", async () => {
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves(services);
            const servicesQuery = {
                'filters': [{
                    key: eFilters.service_offering_guids, value: _.join(_.map(services, 'guid'))
                }]
            };
            mockCfLocal.expects("cfGetManagedServiceInstances").withExactArgs(servicesQuery).resolves(instances);
            assert.deepEqual(_.map(await getServicesInstancesFilteredByType(types), 'label'), [instances[0].label, instances[1].label]);
        });

        it("ok:: nothing match requested services", async () => {
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves([]);
            expect(_.size(await getServicesInstancesFilteredByType(types))).to.be.equal(0);
        });

        it("ok:: undefined services requested", async () => {
            const query = { 'filters': [{ key: eFilters.names, value: _.join(_.map(null, encodeURIComponent)) }, { key: eFilters.space_guids, value: spaceGuid }], per_page: CF_PAGE_SIZE };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves([]);
            expect(_.size(await getServicesInstancesFilteredByType(null))).to.be.equal(0);
        });

        it("exception:: cfGetManagedServiceInstances throws error", async () => {
            const query = { 'filters': [{ key: eFilters.names, value: _.join(_.map(types, encodeURIComponent)) }, { key: eFilters.space_guids, value: spaceGuid }], per_page: CF_PAGE_SIZE };
            mockCfLocal.expects("cfGetServices").withExactArgs(query).resolves(services);
            const error = new Error("cfGetManagedServiceInstances failed");
            mockCfLocal.expects("cfGetManagedServiceInstances").throws(error);
            try {
                await getServicesInstancesFilteredByType(types);
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

        it('ok:: verify call cfGetInstanceKeyParameters', async () => {
            const requestedName = 'cf-my-instance';
            mockCfLocal.expects("cfGetInstanceKeyParameters").withExactArgs(requestedName).resolves();
            await getInstanceCredentials(requestedName);
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
