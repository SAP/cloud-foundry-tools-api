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
import { CliResult, DEFAULT_TARGET, ProgressHandler, CF_PAGE_SIZE, PlanInfo, eFilters } from "../src/types";
import { stringify } from "comment-json";

describe("cf-local unit tests", () => {
    let sandbox: any;
    let cliMock: any;
    let fsExtraMock: any;
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
        cfLocal.clearCacheServiceInstances();
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

        it("tags are not provided, params are provided, exit code is 0", async () => {
            cliResult.error = '';
            cliResult.stdout = "";
            cliResult.exitCode = 0;
            const params = [{ "permissions": ["development"] }, { "metadata": { "data": "value" } }];
            const expectedParams = [stringify(params[0]), stringify(params[1])];
            cliMock.expects("execute").withExactArgs(["bind-local", "-path", filePath, "-service-names", ...instanceNames, "-params", ...expectedParams], undefined, undefined).resolves(cliResult);
            await cfLocal.cfBindLocalServices(filePath, instanceNames, [], [], params);
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

        it("exitCode is 0 but retryFunction returns incorrect result - encoding instance name", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            cliResult.stdout = `{"metadata": {}, "entity": {"last_operation": {"state": "in progress"}}}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            const cliRetry: CliResult = {
                stderr: "",
                stdout: `{ "resources": "[ {}, {} ]"}`,
                exitCode: 0
            };
            const copyRequest = _.cloneDeep(request);
            copyRequest.name = "testInstance+Name";
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=name:testInstance%2BName;q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`], undefined, progressHander.cancelToken).resolves(cliRetry);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(copyRequest), "-X", "POST"], undefined, progressHander.cancelToken).resolves(cliResult);
            try {
                await cfLocal.cfCreateService("testPlanGuid", "testInstance+Name", {}, [], progressHandler);
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.service_not_found("testInstance+Name"));
            }
        });

        it("exitCode is 0 but retryFunction returns incorrect result - instanceName not provided", async () => {
            fsExtraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"SpaceFields": {
                "GUID": "testSpaceGUID"
            }}`);

            const copyRequest = _.cloneDeep(request);
            copyRequest.name = "";
            cliResult.stdout = `{"metadata": {}, "entity": {"last_operation": {"state": "in progress"}}}`;
            cliResult.error = "";
            cliResult.exitCode = 0;
            const cliRetry: CliResult = {
                stderr: "",
                stdout: `{ "resources": "[ {}, {} ]"}`,
                exitCode: 0
            };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let progressReported = false;
            const progressHandler: ProgressHandler = {
                progress: { report: () => { progressReported = true; } },
                cancelToken: token
            };
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=space_guid:testSpaceGUID&results-per-page=${CF_PAGE_SIZE}`], undefined, progressHander.cancelToken).resolves(cliRetry);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/service_instances?accepts_incomplete=true", "-d", JSON.stringify(copyRequest), "-X", "POST"], undefined, progressHander.cancelToken).resolves(cliResult);
            try {
                await cfLocal.cfCreateService("testPlanGuid", "", {}, [], progressHandler);
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.service_not_found("unknown"));
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
                        "service_url": "/v2/services/888f0f72-3603-4f66-97f3-4b66b559f908",
                        "service_plan_url": "/v2/service_plan/888f0f72-3603-4f66-97f3-4b66b559f908",
                        "service_plan_guid": "1111f0f72-3603-4f66-97f3-4b66b559f908",
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
                "resources": [{
                "entity": {
                    "service_plans_url": "service_plans_url_1",
                    "name": "label_1",
                        "description": "description_1",
                        "service_plan_guid": "1234-5678-9876",
                        "service_guid": "5555-6666-9999"
                },
                "metadata": {
                    "guid": 1
                }
                }]
            }`;

            const cliServiceResult: CliResult = {
                stdout: `{
                    "entity": {
                        "label": "myService"
                    },
                    "metadata": {
                    }
                }`,
                stderr: "",
                exitCode: 0,
                error: ""
            };

            cliResult.exitCode = 0;
            cliResult.stdout = JSON.stringify(result);
            const value = 'al gi';
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{"SpaceFields": { "GUID": "e4b60b76-2e56-42a8-b8b6-2ff5fb041266"}}`);
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_instances?q=name:al%20gi;q=space_guid:e4b60b76-2e56-42a8-b8b6-2ff5fb041266&results-per-page=297`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(["curl", `/v2/service_plans?q=service_instance_guid:67755c27-28ed-4087-9688-c07d92f3bcc9&results-per-page=297`], undefined, undefined).resolves(cliPlanResult);
            cliMock.expects("execute").withArgs(["curl", "/v2/services/888f0f72-3603-4f66-97f3-4b66b559f908"]).resolves(cliServiceResult);
            const metadata = await cfLocal.cfGetInstanceMetadata(value);
            assert.deepEqual(metadata, {
                serviceName: result.resources[0].entity.name,
                plan: 'label_1',
                service: 'myService',
                plan_guid: result.resources[0].entity.service_plan_guid
            });
        });
    });

});
