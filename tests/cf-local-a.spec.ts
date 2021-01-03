/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, assert } from "chai";
import * as _ from "lodash";
import * as sinon from "sinon";
import * as fsextra from "fs-extra";
import * as cfLocal from "../src/cf-local";
import * as cli from "../src/cli";
import { messages } from "../src/messages";
import { fail } from "assert";
import { CliResult, CF_PAGE_SIZE, OK, eFilters } from "../src/types";

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

    describe("cfLogin", () => {
        const testArgs = ["login", "-a", testEndpoint, "-u", testUserEmail, "-p", testUserPassword, "-o", "no-org-for-now", "-s", "no-space-for-now"];
        const testOptions = { env: { "CF_COLOR": "false" } };
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 1
        };

        it("stdout is not empty, authentication is OK", async () => {
            cliResult.stdout = `some text Authenticating...\n${OK} some text`;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(OK);
        });

        it("stdout is not empty, authentication is not OK", async () => {
            cliResult.stdout = "some text";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stdout);
        });

        it("stdout is empty, stderr is not empty", async () => {
            cliResult.stdout = "";
            cliResult.stderr = "some error";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stderr);
        });

        it("stdout is empty, stderr is empty", async () => {
            cliResult.stdout = "";
            cliResult.stderr = "";
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfLogin(testEndpoint, testUserEmail, testUserPassword);
            expect(result).to.be.equal(cliResult.stderr);
        });
    });

    describe("cfGetAvailableOrgs", () => {
        const testArgs = ["curl", `/v2/organizations?results-per-page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        it("stderr is not empty", async () => {
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

        it("stdout is an empty object", async () => {
            cliResult.stdout = "{}";
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableOrgs();
            expect(result).to.be.empty;
        });

        it("stdout is not an empty object", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "name": "testName"
                    },
                    "metadata": {
                        "guid": "testGuid"
                    }
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
    });

    describe("cfGetAvailableSpaces", () => {
        const testArgs = ["curl", "/v2/spaces"];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        it("stderr is not empty, no org guid provided", async () => {
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

        it("stderr is not empty, org guid is provided", async () => {
            cliResult.stderr = "some error";
            cliResult.exitCode = 1;
            testArgs[1] = "/v2/organizations/testOrgGuid/spaces";
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetAvailableSpaces("testOrgGuid");
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stderr);
            }
        });

        it("stdout is an empty object", async () => {
            cliResult.stdout = "{}";
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetAvailableSpaces("testOrgGuid");
            expect(result).to.be.empty;
        });

        it("stdout is not an empty object", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "name": "testName"
                    },
                    "metadata": {
                        "guid": "testGuid"
                    }
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
        const configFilePath = cfLocal.cfGetConfigFilePath();
        const spaceGUID = "testSpaceGUID";
        const testArgs = ["curl", `/v2/spaces/${spaceGUID}/services?results-per-page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const stdOutOneService = `{
            "resources": [{
                "entity": {
                    "service_plans_url": "service_plans_url_1",
                    "label": "label_1",
                    "description": "description_1"
                },
                "metadata": {
                    "guid": 1
                }
            }]
        }`;

        it("exitCode is not 0", async () => {
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

        it("exitCode is 0, but there are no services", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields":{"GUID": "${spaceGUID}"}}`);
            const services = await cfLocal.cfGetSpaceServices();
            expect(services).to.be.empty;
        });

        it("exitCode is 0, but there are services", async () => {
            cliResult.stdout = stdOutOneService;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields":{"GUID": "${spaceGUID}"}}`);
            const services = await cfLocal.cfGetSpaceServices();
            expect(services).to.have.lengthOf(1);
        });

        it("request services from specified space, there are services", async () => {
            cliResult.stdout = stdOutOneService;
            const spaceGUID = "specifiedSpaceGUID";
            const CF_PAGE_SIZE = 13;
            const serviceLabel = 'serviceLabel';
            const localTestArgs = ["curl", `/v2/spaces/${spaceGUID}/services?q=label:${serviceLabel}&results-per-page=${CF_PAGE_SIZE}`];
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(localTestArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetSpaceServices({ filters: [{ key: eFilters.label, value: serviceLabel }], 'results-per-page': CF_PAGE_SIZE }, spaceGUID);
            expect(services).to.have.lengthOf(1);
        });
    });

    describe("getServicesFromCF", () => {
        const testArgs = ["curl", `/v2/services?results-per-page=${CF_PAGE_SIZE}`];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("exitCode is not 0", async () => {
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

        it("exitCode is 0, but there are no services", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetServices();
            expect(services).to.be.empty;
        });

        it("exitCode is 0, but there are services", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "service_plans_url": "service_plans_url_1",
                        "label": "label_1",
                        "description": "description_1"
                    },
                    "metadata": {
                        "guid": 1
                    }
                }, {
                    "entity": {
                        "service_plans_url": "service_plans_url_2",
                        "label": "label_2",
                        "description": "description_2"
                    },
                    "metadata": {
                        "guid": 2
                    }
                }]
            }`;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const services = await cfLocal.cfGetServices();
            expect(services).to.have.lengthOf(2);
        });
    });

    describe("getServicePlansFromCF", () => {
        const servicePlanUrl = "testServicePlanUrl";
        const testArgs = ["curl", servicePlanUrl];
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("exitCode is not 0", async () => {
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

        it("exitCode is 0, but there are no services= plans", async () => {
            cliResult.stdout = "{}";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const servicePlan = await cfLocal.cfGetServicePlans(servicePlanUrl);
            expect(_.size(servicePlan)).to.be.equal(0);
        });

        it("exitCode is 0, but there are services", async () => {
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "name": "name_1",
                        "description": "description_1"
                    },
                    "metadata": {
                        "guid": "1"
                    }
                }]
            }`;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(testArgs, undefined, undefined).resolves(cliResult);
            const servicePlan = await cfLocal.cfGetServicePlans(servicePlanUrl);
            assert.deepEqual(_.first(servicePlan), { label: 'name_1', description: 'description_1', guid: '1' });
        });
    });

    describe("getConfigFileField", () => {
        const configFilePath = cfLocal.cfGetConfigFilePath();

        it("field exists", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"name": "testName"}`);
            const result = await cfLocal.cfGetConfigFileField("name");
            expect(result).to.be.equal("testName");
        });

        it("field does not exist", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves("{}");
            const result = await cfLocal.cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });

        it("failed to read a config file", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").throws(new Error());
            const result = await cfLocal.cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });
    });

    describe("getServicesInstances", () => {
        const configFilePath = cfLocal.cfGetConfigFilePath();
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("space not set", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{}`);
            try {
                await cfLocal.cfGetServiceInstances();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.cf_setting_not_set);
            }
        });

        it("space set, no page number provided, exitCode is 1, cliResult.error is defined", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "testError";
            cliResult.stdout = "";
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testError");
            }
        });

        it("space set, no page number provided, exitCode is 1, cliResult.error not defined", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "";
            cliResult.stdout = "testStdout";
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testStdout");
            }
        });

        it("space set, page number provided, exitCode is 1, cliResult.error is defined", async () => {
            cliResult.exitCode = 1;
            cliResult.error = "testError";
            cliResult.stdout = "";
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&page=5&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstances({ page: 5 });
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal("testError");
            }
        });

        it("exitCode is 0, cliResult.stdout is defined", async () => {
            const tags = ["hana", "accounting", "mongodb"];
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name1",
                        "label": "test_service_label1",
                        "tags": ["hana", "accounting", "mongodb"]
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name2",
                        "label": "test_service_label2",
                        "tags": []
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_3",
                        "name": "test_service_name3",
                        "label": "test_service_label3"
                    }
                }]
            }`;
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"], undefined, undefined).resolves({ exitCode: 0, stdout: `{"entity": {"label": "test_service_label1"}}` });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_3"], undefined, undefined).rejects(new Error("some error"));
            const result = await cfLocal.cfGetServiceInstances({
                filters: [
                    { key: eFilters.space_guid, value: '' }, { key: eFilters.service_plan_guid, value: '' }
                ],
                'results-per-page': CF_PAGE_SIZE
            });
            expect(result).to.have.lengthOf(3);
            expect(result[0].serviceName).to.be.equal("test_service_label1");
            expect(result[0].label).to.be.equal("test_service_name1");
            assert.deepEqual(result[0].tags, tags);
            expect(result[1].serviceName).to.be.equal("test_service_label1");
            expect(result[1].label).to.be.equal("test_service_name2");
            assert.deepEqual(result[1].tags, []);
            expect(result[2].serviceName).to.be.equal("unknown");
            expect(result[2].label).to.be.equal("test_service_name3");
        });

        it("exitCode once is 1, cliResult.stdout is defined", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name1",
                        "label": "test_service_label1"
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_2",
                        "name": "test_service_name2",
                        "label": "test_service_label2"
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_3",
                        "name": "test_service_name3",
                        "label": "test_service_label3"
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_4",
                        "name": "test_service_name4",
                        "label": "test_service_label4"
                    }
                }]
            }`;
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"], undefined, undefined).resolves({ stdout: `{"entity": {"label": "testLabel1"}}`, exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_2"], undefined, undefined).resolves({ stdout: `{"entity": {"label": "testLabel2"}}`, exitCode: 1 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_3"], undefined, undefined).resolves({ stdout: `{"entity": {"label"}}`, exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_4"], undefined, undefined).rejects(new Error("some error"));
            const result = await cfLocal.cfGetServiceInstances();
            expect(result).to.have.lengthOf(4);
            expect(result[0].serviceName).to.be.equal("testLabel1");
            expect(result[0].label).to.be.equal("test_service_name1");
            expect(result[1].serviceName).to.be.equal("unknown");
            expect(result[1].label).to.be.equal("test_service_name2");
            expect(result[2].serviceName).to.be.equal("unknown");
            expect(result[2].label).to.be.equal("test_service_name3");
            expect(result[3].serviceName).to.be.equal("unknown");
            expect(result[3].label).to.be.equal("test_service_name4");
        });

        it("cliResult.stdout is partially defined", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name1",
                        "label": "test_service_label1"
                    }
                }, {
                    "entity": {
                        "name": "test_service_name2",
                        "label": "test_service_label2"
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name3",
                        "label": "test_service_label3"
                    }
                }, {
                    "entity": {
                        "service_url": "test_service_url_1",
                        "name": "test_service_name4",
                        "label": "test_service_label4"
                    }
                }]
            }`;
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"], undefined, undefined).resolves({ stdout: `{"entity": {"label": "testLabel1"}}`, exitCode: 0 });
            const result = await cfLocal.cfGetServiceInstances({ filters: [{ key: eFilters.space_guid, value: "testSpaceGUID" }] });
            expect(result).to.have.lengthOf(4);
            expect(result[0].serviceName).to.be.equal("testLabel1");
            expect(result[0].label).to.be.equal("test_service_name1");
            expect(result[1].serviceName).to.be.equal("unknown");
            expect(result[1].label).to.be.equal("test_service_name2");
            expect(result[2].serviceName).to.be.equal("testLabel1");
            expect(result[2].label).to.be.equal("test_service_name3");
            expect(result[3].serviceName).to.be.equal("testLabel1");
            expect(result[3].label).to.be.equal("test_service_name4");
        });

        it("cliResult.stdout is empty", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": []
            }`;
            const servicesUrl = `v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            const result = await cfLocal.cfGetServiceInstances({ filters: [{ key: eFilters.space_guid, value: "testSpaceGUID" }] });
            expect(result).to.have.lengthOf(0);
        });
    });
});
