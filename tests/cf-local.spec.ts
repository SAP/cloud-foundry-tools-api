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
import { CliResult, DEFAULT_TARGET, ProgressHandler, CF_PAGE_SIZE, OK, PlanInfo, eFilters } from "../src/types";

describe("cf-local unit tests", () => {
    let sandbox: any;
    let cliMock: any;
    let fsExtraMock: any;
    const testEndpoint = `https://api.cf.sap.hana.ondemand.com`;
    const testUserEmail = "user@test.com";
    const testUserPassword = "userPassword";
    class Disposable {
        public isDisposed = false;
        public dispose() { this.isDisposed = true; }
    }
    const token = { isCancellationRequested: false, onCancellationRequested: () => new Disposable() };

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
    });

    describe("cfLogin", () => {
        const testArgs = ["login", "-a", testEndpoint, "-u", testUserEmail, "-p", testUserPassword, "-o", "no-org-for-now", "-s", "no-space-for-now"];
        const testOptions = { env: { "CF_COLOR": "false" } };
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
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
                        "service_url": "test_service_url_2",
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
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"]).resolves({ exitCode: 0, stdout: `{"entity": {"label": "test_service_label1"}}` });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_2"]).resolves({ exitCode: 0, stdout: `{"entity": {"label": "test_service_label2"}}` });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_3"]).rejects(new Error("some error"));
            const result = await cfLocal.cfGetServiceInstances({
                filters: [
                    { key: eFilters.space_guid, value: '' }, { key: eFilters.service_plan_guid, value: '' }
                ],
                'results-per-page': CF_PAGE_SIZE
            });
            expect(result).to.have.lengthOf(2);
            expect(result[0].serviceName).to.be.equal("test_service_label1");
            expect(result[0].label).to.be.equal("test_service_name1");
            assert.deepEqual(result[0].tags, tags);
            expect(result[1].serviceName).to.be.equal("test_service_label2");
            expect(result[1].label).to.be.equal("test_service_name2");
            assert.deepEqual(result[1].tags, []);
        });

        it("exitCode once is 1, cliResult.stdout is defined", async () => {
            cfLocal.clearCacheServiceInstances();
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
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"]).resolves({ stdout: `{"entity": {"label": "testLabel1"}}`, exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_2"]).resolves({ stdout: `{"entity": {"label": "testLabel2"}}`, exitCode: 1 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_3"]).resolves({ stdout: `{"entity": {"label"}}`, exitCode: 0 });
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_4"]).rejects(new Error("some error"));
            const result = await cfLocal.cfGetServiceInstances();
            expect(result).to.have.lengthOf(2);
            expect(result[0].serviceName).to.be.equal("testLabel1");
            expect(result[0].label).to.be.equal("test_service_name1");
            expect(result[1].serviceName).to.be.equal("unknown");
            expect(result[1].label).to.be.equal("test_service_name2");
        });

        it("exitCode once is 1, cliResult.stdout is partially defined", async () => {
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
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_1"]).never();
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_3"]).never();
            cliMock.expects("execute").withExactArgs(["curl", "test_service_url_4"]).never();
            const result = await cfLocal.cfGetServiceInstances();
            expect(result).to.have.lengthOf(2);
            expect(result[0].serviceName).to.be.equal("testLabel1");
            expect(result[0].label).to.be.equal("test_service_name1");
            expect(result[1].serviceName).to.be.equal("unknown");
            expect(result[1].label).to.be.equal("test_service_name2");
        });
    });

    describe("bindLocalServices", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const filePath = "testFilePath";
        const instanceNames: string[] = ["name1", "name2"];

        it("tags are not provided, exit code is 0", async () => {
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames], undefined, undefined).resolves(cliResult);
            await cfLocal.cfBindLocalServices(filePath, instanceNames);
        });

        it("tags are provided, exit code is 0", async () => {
            const tags = ["tag1", "tag2"];
            const expectedTags = ["-tags", "tag1", "tag2"];
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames, ...expectedTags], undefined, undefined).resolves(cliResult);
            await cfLocal.cfBindLocalServices(filePath, instanceNames, tags);
        });

        it("tags are not provided, exit code is 1", async () => {
            cliResult.error = "testError";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames], undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfBindLocalServices(filePath, instanceNames);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("tags are not provided, exit code is 1", async () => {
            cliResult.error = "";
            cliResult.stdout = 'some error occured';
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames], undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfBindLocalServices(filePath, instanceNames);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stdout);
            }
        });

        it("serviceKeyNames are provided, exit code is 0", async () => {
            cliResult.error = "";
            cliResult.stdout = '';
            cliResult.exitCode = 0;
            const tags = ["tag1", "tag2"];
            const expectedTags = ["-tags", "tag1", "tag2"];
            const keyNames = ["keyName1", "keyName2"];
            const expectedKeyNames = ["-service-keys", `${keyNames[0]}`, `${keyNames[1]}`];
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames, ...expectedTags, ...expectedKeyNames], undefined, undefined).resolves(cliResult);
            await cfLocal.cfBindLocalServices(filePath, instanceNames, tags, keyNames);
        });

        it("tags are not provided, exit code <> 0", async () => {
            cliResult.error = '';
            cliResult.stdout = "testError";
            cliResult.exitCode = 2;
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames], undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfBindLocalServices(filePath, instanceNames);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stdout);
            }
        });
    });

    describe("createService", () => {
        const configFilePath = cfLocal.cfGetConfigFilePath();
        const progressHander: ProgressHandler = { progress: undefined, cancelToken: token };
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const request = {
            name: "testInstanceName",
            space_guid: "testSpaceGUID",
            service_plan_guid: "testPlanGuid",
            parameters: {}
        };
        _.set(request, "tags", []);

        it("space GUID is undefined", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{}`);

            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], null);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.space_not_set);
            }
        });

        it("space GUID undefined, exitCode is 1", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.error = "testError";
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, token).resolves(cliResult);

            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHander);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("exitCode is 0", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, token).resolves(cliResult);
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler);
            expect(progressReported).to.be.true;
        });

        it("exitCode is 0 - undefined progress handler", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"]).resolves(cliResult);
            await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, []);
        });

        it("exitCode is 0 - empty progress handler", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"]).resolves(cliResult);
            await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], { progress: undefined, cancelToken: undefined });
        });

        it("exitCode is 0 but retryFunction throws exception", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{"metadata": {}, "entity": {"last_operation": {"state": "in progress"}}}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            const error = new Error('retry function exception');
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=name:testInstanceName;q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`], undefined, progressHander.cancelToken).rejects(error);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, progressHander.cancelToken).resolves(cliResult);
            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler);
                expect(progressReported).to.be.true;
            } catch (e) {
                expect(e.message).to.be.equal(error.message);
            }
        });

        it("exitCode is 0, cancellation requested", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{}`;
            cliResult.error = "";
            cliResult.exitCode = 0;

            let progressReported = false;
            const cancelEvent = {
                test: () => {
                    return new Disposable();
                }
            };
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: { isCancellationRequested: true, onCancellationRequested: cancelEvent.test }
            };
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, progressHandler.cancelToken).resolves(cliResult);
            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.create_service_canceled_by_requester);
            }
            expect(progressReported).to.be.true;
        });

        it("exitCode is 0, exceeded number of attempts", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{
                "entity": {
                    "name": "testResourceName"
                }
            }`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, progressHandler.cancelToken).resolves(cliResult);
            const result = await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler, 0);

            expect(result).to.be.equal(messages.exceed_number_of_attempts("testResourceName"));
            expect(progressReported).to.be.true;
        });

        it("exitCode is 0, entity state failed", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{
                "entity": {
                    "name": "testResourceName",
                    "last_operation": {
                        "state": "failed",
                        "description": "failure description"
                    }
                }
            }`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, progressHandler.cancelToken).resolves(cliResult);
            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.failed_creating_entity("failure description", "testResourceName"));
            }
            expect(progressReported).to.be.true;
        });

        it("exitCode is 0, entity state in progress", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{
                "entity": {
                    "name": "testResourceName",
                    "last_operation": {
                        "state": "in progress"
                    }
                }
            }`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(request), "-X", "POST"], undefined, progressHandler.cancelToken).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=name:testInstanceName;q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`], undefined, progressHandler.cancelToken).resolves({ exitCode: 0, stdout: `{"total_results": 1, "resources": [{"entity": {"name": "testResourceName"}}]}` });
            const result = await cfLocal.cfCreateService("testPlanGuid", "testInstanceName", {}, [], progressHandler, 1);
            expect(result).to.be.equal(messages.exceed_number_of_attempts("testResourceName"));
            expect(progressReported).to.be.true;
        });
    });

    describe("getCFTargets", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "testError",
            exitCode: 1,
            error: "testError"
        };

        it("targets error", async () => {
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetTargets();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("No targets have been saved yet", async () => {
            cliResult.stdout = "test - No targets have been saved yet";
            cliResult.error = "";
            cliResult.stderr = '';
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            const expectedResult = [{ label: DEFAULT_TARGET, isCurrent: true, isDirty: false }];
            const result = await cfLocal.cfGetTargets();
            expect(result).to.be.deep.equal(expectedResult);
        });

        it("is not a registered command", async () => {
            cliResult.stdout = "test - is not a registered command";
            cliResult.error = "";
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            const expectedResult = [{ label: DEFAULT_TARGET, isCurrent: true, isDirty: false }];
            const result = await cfLocal.cfGetTargets();
            expect(result).to.be.deep.equal(expectedResult);
        });

        it("cliResult.stdout is empty string", async () => {
            cliResult.stdout = "";
            cliResult.error = "";
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTargets();
            expect(result).to.be.empty;
        });

        it("there is '(current' in parentthesisPos", async () => {
            cliResult.stdout = "test modified (current  test";
            cliResult.error = "";
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTargets();
            expect(result).to.be.deep.equal([{ label: "test modified", isCurrent: true, isDirty: true }]);
        });

        it("no '(current' in parentthesisPos", async () => {
            cliResult.stdout = "test substring";
            cliResult.error = "";
            cliMock.expects("execute").withExactArgs(["targets"], undefined, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTargets();
            expect(result).to.be.deep.equal([{ label: cliResult.stdout, isCurrent: false, isDirty: false }]);
        });
    });

    describe("getServiceInstance", () => {
        const instanceName = "testInstanceName";
        const spaceGuid = "testSpaceGuid";
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 1,
            error: "testError"
        };
        const query = { filters: [{ key: eFilters.name, value: instanceName }, { key: eFilters.space_guid, value: spaceGuid }], 'direction': '' };
        const args = ["curl", `/v2/service_instances?q=name:${instanceName};q=space_guid:${spaceGuid}&results-per-page=${CF_PAGE_SIZE}`];

        it("exitCode is 1", async () => {
            cliMock.expects("execute").withExactArgs(args, undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceInstance(query);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("exitCode is 0, total_results is 1", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{"total_results": 1, "resources": [{"metadata": {}, "entity": {}}]}`;

            cliMock.expects("execute").withExactArgs(args, undefined, undefined).resolves(cliResult);

            const result = await cfLocal.cfGetServiceInstance(query);
            expect(result.entity).to.be.not.undefined;
            expect(result.metadata).to.be.not.undefined;
        });

        it("exitCode is 0, total_results is not 1", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{"total_results": 2, "resources": [{}, {}]}`;

            cliMock.expects("execute").withExactArgs(args, undefined, undefined).resolves(cliResult);

            try {
                await cfLocal.cfGetServiceInstance(query);
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(messages.service_not_found(instanceName));
            }
        });

    });

    describe("getServicePlansList", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 1,
            error: "testError"
        };
        const args = ["curl", `/v2/service_plans?results-per-page=${CF_PAGE_SIZE}`];

        it("getServicePlansList - ok", async () => {
            const result = {
                "resources": [{
                    "entity": {
                        "name": "name_1",
                        "description": "description_1"
                    },
                    "metadata": {
                        "guid": '1'
                    }
                }, {
                    "entity": {
                        "name": "name_2",
                        "description": "description_2"
                    },
                    "metadata": {
                        "guid": '2'
                    }
                }]
            };
            cliResult.stdout = JSON.stringify(result);
            cliResult.stderr = "";
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliMock.expects("execute").withArgs(args).resolves(cliResult);
            const plans: PlanInfo[] = await cfLocal.cfGetServicePlansList();
            expect(_.size(plans)).to.be.equal(2);
            assert.deepEqual(plans[0], { label: result.resources[0].entity.name, guid: result.resources[0].metadata.guid, description: result.resources[0].entity.description });
        });

        it("getServicePlansList - rejected error", async () => {
            cliResult.stdout = "";
            cliResult.stderr = "";
            cliResult.exitCode = 1;
            cliResult.error = "some error occured";
            cliMock.expects("execute").withArgs(args).resolves(cliResult);
            try {
                await cfLocal.cfGetServicePlansList();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.error);
            }
        });

        it("getServicePlansList - rejected failed", async () => {
            cliResult.stdout = "FAILED. some error occured";
            cliResult.stderr = "";
            cliResult.exitCode = 1;
            cliResult.error = "";
            cliMock.expects("execute").withArgs(args).resolves(cliResult);
            try {
                await cfLocal.cfGetServicePlansList();
                fail("test should fail");
            } catch (error) {
                expect(error.message).to.be.equal(cliResult.stdout);
            }
        });
    });

    describe("cfSetOrgSpace", () => {
        const testOrg = "testOrg";
        const testArgs = ["target", "-o", testOrg];

        it("space is not provided", async () => {
            cliMock.expects("execute").withArgs(testArgs).resolves({ exitCode: -1 });
            try {
                await cfLocal.cfSetOrgSpace(testOrg);
                fail("should fail");
            } catch (e) {
                // continue test
            }
        });

        it("space is provided", async () => {
            const testSpace = "testSpace";
            cliMock.expects("execute").withArgs(testArgs.concat(["-s", testSpace])).resolves({ exitCode: 0 });
            await cfLocal.cfSetOrgSpace(testOrg, testSpace);
        });
    });

    describe("cfGetServiceKeys", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const result = {
            "total_results": 1,
            "total_pages": 1,
            "resources": [
                {
                    "metadata": {
                        "guid": "67755c27-28ed-4087-9688-c07d92f3bcc9",
                        "url": "/v2/service_keys/67755c27-28ed-4087-9688-c07d92f3bcc9",
                        "created_at": "2016-06-08T16:41:23Z",
                        "updated_at": "2016-06-08T16:41:26Z"
                    },
                    "entity": {
                        "name": "name-166",
                        "service_instance_guid": "888f0f72-3603-4f66-97f3-4b66b559f908",
                        "credentials": {
                            "creds-key-13": "creds-val-13"
                        },
                        "service_instance_url": "/v2/service_instances/888f0f72-3603-4f66-97f3-4b66b559f908",
                        "service_plan_url": "/v2/service_plan/888f0f72-3603-4f66-97f3-4b66b559f908",
                        "service_key_parameters_url": "/v2/service_keys/67755c27-28ed-4087-9688-c07d92f3bcc9/parameters"
                    }
                }
            ]
        };

        it("no filters provided", async () => {
            try {
                await cfLocal.cfGetServiceKeys({ filters: [{ key: eFilters.gateway_name, value: 'gateway' }] });
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.no_valid_filters);
            }
        });

        it("only name filter provided", async () => {
            cliResult.exitCode = 0;
            cliResult.stdout = JSON.stringify(result);
            const value = 'instance';
            cliMock.expects("execute").withArgs(['curl', `v2/service_keys?q=name:${value}&results-per-page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            const answer = await cfLocal.cfGetServiceKeys({ filters: [{ key: eFilters.name, value }] });
            assert.deepEqual(answer, result.resources);
        });

        it("name and service_instance_guid filters provided", async () => {
            cliResult.exitCode = 0;
            cliResult.stdout = JSON.stringify(result);
            const value = 'instance';
            const guid = 'instance_guid';
            cliMock.expects("execute").withArgs(['curl', `v2/service_keys?q=name:${value};q=service_instance_guid:${guid}&results-per-page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            const answer = await cfLocal.cfGetServiceKeys({ filters: [{ key: eFilters.name, value }, { key: eFilters.service_instance_guid, value: guid }] });
            assert.deepEqual(answer, result.resources);
        });

        it("rejected error", async () => {
            cliResult.exitCode = 1;
            cliResult.error = 'some error';
            cliResult.stdout = "JSON.stringify(result);";
            const value = 'instance';
            cliMock.expects("execute").withArgs(['curl', `v2/service_keys?q=name:${value}&results-per-page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceKeys({ filters: [{ key: eFilters.name, value }] });
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(cliResult.error);
            }
        });

        it("rejected error in stdout", async () => {
            cliResult.exitCode = 1;
            cliResult.error = '';
            cliResult.stdout = "JSON.stringify(result);";
            const value = 'instance';
            cliMock.expects("execute").withArgs(['curl', `v2/service_keys?q=name:${value}&results-per-page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            try {
                await cfLocal.cfGetServiceKeys({ filters: [{ key: eFilters.name, value }] });
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(cliResult.stdout);
            }
        });

        it("cfGetInstanceCredentials", async () => {
            cliResult.exitCode = 0;
            cliResult.stdout = JSON.stringify(result);
            const value = 'instance';
            cliMock.expects("execute").withArgs(['curl', `v2/service_keys?q=name:${value}&results-per-page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            const credentials = await cfLocal.cfGetInstanceCredentials({ filters: [{ key: eFilters.name, value }] });
            assert.deepEqual(credentials, [result.resources[0].entity.credentials]);
        });

        it("cfGetInstanceMetadata", async () => {
            const cliPlanResult: CliResult = {
                stdout: "",
                stderr: "",
                exitCode: 0,
                error: ""
            };
            cliPlanResult.stdout = `{
                "entity": {
                    "service_plans_url": "service_plans_url_1",
                    "name": "label_1",
                    "description": "description_1"
                },
                "metadata": {
                    "guid": 1
                }
            }`;

            cliResult.exitCode = 0;
            cliResult.stdout = JSON.stringify(result);
            const value = 'al gi';
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{"SpaceFields": { "GUID": "e4b60b76-2e56-42a8-b8b6-2ff5fb041266"}}`);
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=name:al%20gi;q=space_guid:e4b60b76-2e56-42a8-b8b6-2ff5fb041266&results-per-page=297`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_plan/888f0f72-3603-4f66-97f3-4b66b559f908`], undefined, undefined).resolves(cliPlanResult);
            const metadata = await cfLocal.cfGetInstanceMetadata(value);
            assert.deepEqual(metadata, {
                serviceName: 'name-166',
                plan: 'label_1',
                service: 'unknown'
            });
        });
    });

    describe("cfGetTarget", () => {
        const testArgs = ["target"];
        const testOptions = { env: { "CF_COLOR": "false" } };
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0
        };

        const endpoint = 'https://api.cf.sap.hana.ondemand.com';
        const org = 'devx2';
        const space = 'platform2';
        const user = 'testUser';
        const apiVer = '2.146.0';
        const noSpace = "No space targeted, use 'cf target -s SPACE'";
        const noOrgNoSpace = "No org or space targeted, use 'cf target -o ORG -s SPACE'";

        it("target - no space targeted", async () => {
            cliResult.stdout = `"api endpoint:   ${endpoint}"
            "api version:    ${apiVer}"
            "user:           ${user}"
            "org:            ${org}"
            ${noSpace}`;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTarget();
            expect(result["api endpoint"]).to.be.equal(endpoint);
            expect(result["api version"]).to.be.equal(apiVer);
            expect(result.user).to.be.equal(user);
            expect(result.org).to.be.equal(org);
            expect(result.space).to.be.equal(undefined);
        });

        it("target - no space no org targeted", async () => {
            cliResult.stdout = `"api endpoint:   ${endpoint}"
            "api version:    ${apiVer}"
            "user:           ${user}"
            ${noOrgNoSpace}`;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTarget();
            expect(result["api endpoint"]).to.be.equal(endpoint);
            expect(result["api version"]).to.be.equal(apiVer);
            expect(result.user).to.be.equal(user);
            expect(result.org).to.be.equal(undefined);
            expect(result.space).to.be.equal(undefined);
        });

        it("tagret - ok", async () => {
            cliResult.stdout = `"api endpoint:   ${endpoint}"
            "api version:    ${apiVer}"
            "user:           ${user}"
            "org:            ${org}"
            "space:            ${space}"
            `;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTarget();
            expect(result["api endpoint"]).to.be.equal(endpoint);
            expect(result["api version"]).to.be.equal(apiVer);
            expect(result.user).to.be.equal(user);
            expect(result.org).to.be.equal(org);
            expect(result.space).to.be.equal(space);
        });

        it("target - error, not logged in", async () => {
            cliResult.stdout = `FAILED
            `;
            cliResult.stderr = `Not logged in. Use 'cf login' or 'cf login --sso' to log in.
            `;
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetTarget();
                fail("test should fail");
            } catch (e) {
                expect(_.get(e, 'message')).to.be.equal(cliResult.stderr);
            }
        });

        it("target - error", async () => {
            cliResult.stdout = `FAILED
            `;
            cliResult.stderr = '';
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetTarget();
                fail("test should fail");
            } catch (e) {
                expect(_.get(e, 'message')).to.be.equal(cliResult.stdout);
            }
        });
    });

    describe("cfGetUpsInstances", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("exitCode is 0, cliResult.stdout is defined", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            cliResult.stdout = `{
                "resources": [{
                    "entity": {
                        "name": "test_service_name1",
                        "type": "user_provided_service_instance"
                    }
                }, {
                    "entity": {
                        "name": "test_service_name2",
                        "type": "user_provided_service_instance",
                        "tags": ["hana", "mongodb"]
                    }
                }]
            }`;
            const servicesUrl = `v2/user_provided_service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`;
            cliMock.expects("execute").withArgs(["curl", servicesUrl]).resolves(cliResult);
            const query: any = {
                page: null,
                'wrongKey': '',
                filters: [
                    { key: eFilters.space_guid, value: 'testSpaceGUID' }
                ],
                'results-per-page': CF_PAGE_SIZE
            };
            const result = await cfLocal.cfGetUpsInstances(query);
            expect(result).to.have.lengthOf(2);
            expect(result[0].label).to.be.equal("test_service_name1");
            assert.deepEqual(result[0].tags, []);
            expect(result[1].label).to.be.equal("test_service_name2");
            expect(result[1].serviceName).to.be.equal("user_provided_service_instance");
            assert.deepEqual(result[1].tags, ["hana", "mongodb"]);
        });

    });

    describe("bindLocalUps", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const filePath = "testFilePath";
        const instanceNames: string[] = ["name-test-i+!_@)#($*%&^&-(ups)", "name-NHY&*^%$+_*-1mznx"];
        const tags: string[] = ['tag1', 'tag2'];

        it("bindLocalUps, exit code is 0", async () => {
            cliMock.expects("execute").withExactArgs([
                "bind-local-ups", "-path", filePath, "-service-names", encodeURI(instanceNames[0]), "-service-names", encodeURI(instanceNames[1]), '-tags', tags[0], '-tags', tags[1]
            ], undefined, undefined).resolves(cliResult);
            await cfLocal.cfBindLocalUps(filePath, instanceNames, tags);
        });
    });
});
