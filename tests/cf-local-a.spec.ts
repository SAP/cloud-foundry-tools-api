import { expect, assert } from "chai";
import * as _ from "lodash";
import * as sinon from "sinon";
import * as fsextra from "fs-extra";
import * as cfLocal from "../src/cf-local";
import * as cli from "../src/cli";
import { fail } from "assert";
import { messages } from "../src/messages";
import { CliResult, CF_PAGE_SIZE, OK, eFilters, eOperation } from "../src/types";
import { cfGetConfigFileField, cfGetConfigFilePath } from "../src/utils";

describe("cf-local-a unit tests", () => {
    let sandbox: any;
    let cliMock: any;
    let fsExtraMock: any;
    const testEndpoint = `https://api.cf.sap.hana.ondemand.com`;
    const testUserEmail = "user@test.com";
    const testUserPassword = "userPassword";

    before(() => {
        sandbox = sinon.createSandbox();
    });

    after(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        cliMock = sandbox.mock(cli.Cli);
        fsExtraMock = sandbox.mock(fsextra);
    });

    afterEach(() => {
        cliMock.verify();
        fsExtraMock.verify();
        cfLocal.clearCacheServiceInstances();
    });

    describe("cfLogin scope", () => {
        const testArgs = ["login", "-a", testEndpoint, "-u", testUserEmail, "-p", testUserPassword, "-o", "no-org-for-now", "-s", "no-space-for-now"];
        const testOptions = { env: { "CF_COLOR": "false" } };
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 1
        };

        it("success:: stdout is not empty, authentication is OK", async () => {
            cliResult.stdout = `some text Authenticating...\n${OK} some text`;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(OK);
        });

        it("fail:: stdout is not empty, authentication is not OK", async () => {
            cliResult.stdout = "some text";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stdout);
        });

        it("fail:: stdout is empty, stderr is not empty", async () => {
            cliResult.stdout = "";
            cliResult.stderr = "some error";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stderr);
        });

        it("fail:: stdout is empty, stderr is empty", async () => {
            cliResult.stdout = "";
            cliResult.stderr = "";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stderr);
        });
    });

    describe("cfGetAvailableOrgs", () => {
        const testArgs = ["curl", `/v3/organizations?per_page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        it("fail:: stderr is not empty", async () => {
            cliResult.stderr = "some error";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetAvailableOrgs();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stderr);
            }
        });

        it("success:: but stdout is an empty object", async () => {
            cliResult.stdout = "{}";
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableOrgs();
            expect(result).to.be.empty;
        });

        it("success:: stdout has not an empty object", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "name": "testName",
                    "guid": "testGuid",
                    "metadata": {}
                }]
            }`;
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableOrgs();
            expect(result).to.have.lengthOf(1);
            expect(result[0].label).to.be.equal("testName");
            expect(result[0].guid).to.be.equal("testGuid");
        });

        it("fail:: not allowed filter received", async () => {
            try {
                await cfLocal.cfGetAvailableOrgs({ filters: [{ key: eFilters.service_offering_guids, value: 'value' }] });
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.not_allowed_filter(eFilters.service_offering_guids, "organizations"));
            }
        });
    });

    describe("cfGetAvailableSpaces", () => {
        const testArgs = ["curl", "/v3/spaces?per_page=297"];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        it("fail:: stderr is not empty, no org guid provided", async () => {
            cliResult.stderr = "some error";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetAvailableSpaces();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stderr);
            }
        });

        it("fail:: stderr is not empty, org guid is provided", async () => {
            cliResult.stderr = "some error";
            cliResult.exitCode = 1;
            const spaceGuid = "testOrgGuid";
            testArgs[1] = `/v3/spaces?organization_guids=${spaceGuid}&per_page=297`;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetAvailableSpaces(spaceGuid);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stderr);
            }
        });

        it("success:: stdout has an empty object result", async () => {
            cliResult.stdout = "{}";
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableSpaces("testOrgGuid");
            expect(result).to.be.empty;
        });

        it("success:: stdout has structured result", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "name": "testName",
                    "guid": "testGuid"
                }]
            }`;
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableSpaces("testOrgGuid");
            expect(result).to.have.lengthOf(1);
            expect(result[0].label).to.be.equal("testName");
            expect(result[0].guid).to.be.equal("testGuid");
        });
    });

    describe("cfGetSpaceServices", () => {
        const configFilePath = cfGetConfigFilePath();
        const spaceGUID = "testSpaceGUID";
        const testArgs = ["curl", `/v3/service_offerings?space_guids=${spaceGUID}&per_page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const stdOutOneService = `{
            "resources": [{
                "links": {
                    "service_plans": {
                        "href": "service_plans_url_1"
                    }
                },
                "name": "label_1",
                "description": "description_1",
                "guid": 1
            }]
        }`;

        it("fail:: exitCode is not 0", async () => {
            cliResult.error = "some error";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields":{"GUID": "${spaceGUID}"}}`);
            try {
                await cfLocal.cfGetSpaceServices();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("success:: exitCode is 0, but there are no services found", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields":{"GUID": "${spaceGUID}"}}`);
            const services = await cfLocal.cfGetSpaceServices();
            expect(services).to.be.empty;
        });

        it("ok:: exitCode is 0, there are services found", async () => {
            cliResult.stdout = stdOutOneService;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields":{"GUID": "${spaceGUID}"}}`);
            const services = await cfLocal.cfGetSpaceServices();
            expect(services).to.have.lengthOf(1);
        });

        it("ok:: request services from specified space, there are services found", async () => {
            cliResult.stdout = stdOutOneService;
            const spaceGUID = "specifiedSpaceGUID";
            const CF_PAGE_SIZE = 13;
            const serviceLabel = 'serviceLabel';
            const localTestArgs = ["curl", `/v3/service_offerings?names=${serviceLabel}&space_guids=${spaceGUID}&per_page=${CF_PAGE_SIZE}`];
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(localTestArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetSpaceServices({ filters: [{ key: eFilters.names, value: serviceLabel }], 'per_page': CF_PAGE_SIZE }, spaceGUID);
            expect(services).to.have.lengthOf(1);
        });

        it("exception:: not allowed filter received", async () => {
            try {
                await cfLocal.cfGetSpaceServices({ filters: [{ key: eFilters.service_offering_guids, value: 'value' }] }, 'space-guid-test');
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.not_allowed_filter(eFilters.service_offering_guids, "service_offerings"));
            }
        });
    });

    describe("cfGetServices - service_offering calls", () => {
        const testArgs = ["curl", `/v3/service_offerings?per_page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("fail:: run exitCode is not 0", async () => {
            cliResult.error = "some error";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetServices();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("ok:: exitCode is 0, but there are no services found", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetServices();
            expect(services).to.be.empty;
        });

        it("ok:: exitCode is 0, there are services found", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "links": {
                        "service_plans": {
                            "href": "service_plans_url_1"
                        }
                    },
                    "name": "label_1",
                    "description": "description_1",
                    "guid": 1
                }, {
                    "links": {
                        "service_plans": {
                            "href": "service_plans_url_2"
                        }
                    },
                    "name": "label_2",
                    "description": "description_2",
                    "guid": 2
                }]
            }`;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetServices();
            expect(services).to.have.lengthOf(2);
        });
    });

    describe("cfGetServicePlans scope", () => {
        const servicePlanUrl = "testServicePlanUrl";
        const testArgs = ["curl", servicePlanUrl];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("fail:: exitCode is not 0", async () => {
            cliResult.error = "some error";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetServicePlans(servicePlanUrl);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("ok:: exitCode is 0, but there are no services found by requested plan url", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const servicePlan = await cfLocal.cfGetServicePlans(servicePlanUrl);
            expect(_.size(servicePlan)).to.be.equal(0);
        });

        it("ok:: exitCode is 0, there are services found by requested plan url", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "name": "name_1",
                    "description": "description_1",
                    "guid": "1"
                }]
            }`;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const servicePlan = await cfLocal.cfGetServicePlans(servicePlanUrl);
            assert.deepEqual(_.first(servicePlan), { label: 'name_1', description: 'description_1', guid: '1' });
        });
    });

    describe("getConfigFileField scope", () => {
        const configFilePath = cfGetConfigFilePath();

        it("ok:: required field found and exists", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"name": "testName"}`);
            const result = await cfGetConfigFileField("name");
            expect(result).to.be.equal("testName");
        });

        it("ok:: required field does not exist, undefined value returned", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves("{}");
            const result = await cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });

        it("ok:: failed to read a config file, undefined value returned", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").throws(new Error());
            const result = await cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });
    });

    describe("cfGetServiceInstances calls", () => {
        const configFilePath = cfGetConfigFilePath();
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const spaceGuid = "testSpaceGUID";
        const planName = "test_service_label1";
        const servicesGuids = ['service-guid-1', 'service-guid-2', 'service-guid-3'];
        const servicesNames = ['service-1', 'service-2', 'service-3'];
        const resultPlan = {
            name: planName,
            included: {
                service_offerings: [{
                    guid: servicesGuids[1],
                    name: servicesNames[1]
                },
                {
                    guid: servicesGuids[0],
                    name: servicesNames[0]
                }]
            },
            relationships: {
                service_offering: {
                    data: {
                        guid: servicesGuids[0]
                    }
                }
            }
        };
        const planGuids = ['service_plan-guid-1', 'service_plan-guid-3', 'service_plan-guid-2', 'service_plan-guid-4'];
        const serviceNames = ['test_service_name1', 'test_service_name2', 'test_service_name3', 'test_service_name4'];

        it("exception:: cf space not defined, default space value is unavailable", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{}`);
            try {
                await cfLocal.cfGetServiceInstances();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.cf_setting_not_set);
            }
        });

        it("exception:: cf space defined, no page number provided, exitCode is 1, cliResult.error is defined", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "testError";
            cliResult.stdout = "";
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": { "GUID": "${spaceGuid}" } }`);
            const param = `v3/service_instances?fields[service_plan]=guid,name&type=managed&space_guids=${spaceGuid}&per_page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testError");
            }
        });

        it("exception:: cf space defined, no page number provided, exitCode is 1, query operation filter usied", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "";
            cliResult.stdout = "testStdout";
            const timestamp = '2020-06-30T23:49:04Z';
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": { "GUID": "${spaceGuid}" } }`);
            const param = `v3/service_instances?created_ats[gte]=${timestamp}&fields[service_plan]=guid,name&type=managed&space_guids=${spaceGuid}&per_page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances({filters: [{key: eFilters.created_ats, value: timestamp, op: eOperation.gte}]});
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testStdout");
            }
        });

        it("exception:: cf space set, page number provided, exitCode is 1, cliResult.error is defined", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "testError";
            cliResult.stdout = "";
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": { "GUID": "${spaceGuid}" } }`);
            const param = `v3/service_instances?fields[service_plan]=guid,name&type=managed&space_guids=${spaceGuid}&page=5&per_page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances({ page: 5 });
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testError");
            }
        });

        it("ok:: several service plan calls fails -> checking error in service_plan response", async () => {
            const tags = ["hana", "accounting", "mongodb"];
            cliResult.exitCode = 0;
            cliResult.error = "";

            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": { "GUID": "${spaceGuid}" } }`);
            const param = `v3/service_instances?fields[service_plan]=guid,name&type=managed&space_guids=${spaceGuid}&per_page=${CF_PAGE_SIZE}`;
            const plansResult = {
                "resources": [{
                    "name": serviceNames[0],
                    "tags": ["hana", "accounting", "mongodb"],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[0]
                            }
                        }
                    }
                }, {
                    "name": serviceNames[1],
                    "tags": [],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[0]
                            }
                        }
                    }
                }, {
                    "name": serviceNames[2],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[1]
                            }
                        }
                    }
                }]
            };
            cliResult.stdout = JSON.stringify(plansResult);
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-1?include=service_offering"], undefined, undefined).resolves({ exitCode: 0, stdout: JSON.stringify(resultPlan) });
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-3?include=service_offering"], undefined, undefined).resolves({ exitCode: 0, stdout: `{"errors": [{"error": "some error"}]}` });
            const result = await cfLocal.cfGetServiceInstances({
                filters: [
                    { key: eFilters.space_guids, value: '' }, { key: eFilters.service_plan_guids, value: '' }
                ],
                'per_page': CF_PAGE_SIZE
            });
            expect(result).to.have.lengthOf(3);
            expect(result[0].serviceName).to.be.equal(servicesNames[0]);
            expect(result[0].plan).to.be.equal(planName);
            expect(result[0].plan_guid).to.be.equal(planGuids[0]);
            expect(result[0].label).to.be.equal(serviceNames[0]);
            assert.deepEqual(result[0].tags, tags);
            expect(result[1].serviceName).to.be.equal(servicesNames[0]);
            expect(result[1].plan).to.be.equal(planName);
            expect(result[1].plan_guid).to.be.equal(planGuids[0]);
            expect(result[1].label).to.be.equal(serviceNames[1]);
            assert.deepEqual(result[1].tags, []);
            expect(result[2].serviceName).to.be.equal("unknown");
            expect(result[2].plan).to.be.equal("unknown");
            expect(result[2].plan_guid).to.be.equal(planGuids[1]);
            expect(result[2].label).to.be.equal(serviceNames[2]);
        });

        it("ok:: few calls for service plan fails or have errord -> checking wrong output and rejection in service_plan response", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            const plansResult = {
                "resources": [{
                    "name": serviceNames[0],
                    "tags": ["hana", "accounting", "mongodb"],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[0]
                            }
                        }
                    }
                }, {
                    "name": serviceNames[1],
                    "tags": [],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[1]
                            }
                        }
                    }
                }, {
                    "name": serviceNames[2],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[2]
                            }
                        }
                    }
                }, {
                    "name": serviceNames[3],
                    "relationships": {
                        "service_plan": {
                            "data": {
                                "guid": planGuids[3]
                            }
                        }
                    }
                }]
            };
            cliResult.stdout = JSON.stringify(plansResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": { "GUID": "${spaceGuid}" } }`);
            const param = `v3/service_instances?fields[service_plan]=guid,name&type=managed&space_guids=${spaceGuid}&per_page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-1?include=service_offering"], undefined, undefined).resolves({ stdout: JSON.stringify(resultPlan), exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-2?include=service_offering"], undefined, undefined).resolves({ stdout: JSON.stringify(resultPlan), exitCode: 1 });
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-3?include=service_offering"], undefined, undefined).resolves({ stdout: `{"entity": {"label"}}`, exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_plans/service_plan-guid-4?include=service_offering"], undefined, undefined).rejects(new Error("some error"));
            const result = await cfLocal.cfGetServiceInstances();
            expect(result).to.have.lengthOf(4);
            expect(result[0].serviceName).to.be.equal(servicesNames[0]);
            expect(result[0].plan).to.be.equal(planName);
            expect(result[0].plan_guid).to.be.equal(planGuids[0]);
            expect(result[0].label).to.be.equal(serviceNames[0]);
            expect(result[1].serviceName).to.be.equal("unknown");
            expect(result[1].plan).to.be.equal('unknown');
            expect(result[1].plan_guid).to.be.equal(planGuids[1]);
            expect(result[1].label).to.be.equal(serviceNames[1]);
            expect(result[2].serviceName).to.be.equal("unknown");
            expect(result[2].plan).to.be.equal('unknown');
            expect(result[2].plan_guid).to.be.equal(planGuids[2]);
            expect(result[2].label).to.be.equal(serviceNames[2]);
            expect(result[3].serviceName).to.be.equal("unknown");
            expect(result[3].plan).to.be.equal('unknown');
            expect(result[3].plan_guid).to.be.equal(planGuids[3]);
            expect(result[3].label).to.be.equal(serviceNames[3]);
        });

        it("ok:: no service instances found", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": []
            }`;
            const param = `v3/service_instances?space_guids=${spaceGuid}&fields[service_plan]=guid,name&type=managed&per_page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", param]).resolves(cliResult);
            const result = await cfLocal.cfGetServiceInstances({ filters: [{ key: eFilters.space_guids, value: spaceGuid }] });
            expect(result).to.have.lengthOf(0);
        });
    });
});
