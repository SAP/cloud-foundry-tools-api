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
import { fail } from "assert";
import { CliResult, CF_PAGE_SIZE, eFilters } from "../src/types";
import { stringify, parse } from "comment-json";
import { messages } from "../src/messages";

describe("cf-local-b unit tests", () => {
    let sandbox: any;
    let cliMock: any;
    let fsExtraMock: any;

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
            const result = await cfLocal.cfGetTarget(true);
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
            const result = await cfLocal.cfGetTarget(true);
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
            const result = await cfLocal.cfGetTarget(true);
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
                await cfLocal.cfGetTarget(true);
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
                await cfLocal.cfGetTarget(true);
                fail("test should fail");
            } catch (e) {
                expect(_.get(e, 'message')).to.be.equal(cliResult.stdout);
            }
        });

        it("target - no space targeted - auth-token expired", async () => {
            cliResult.stdout = ``;
            cliResult.stderr = `authentication error`;
            cliResult.exitCode = 1;
            cliMock.expects("execute").withExactArgs(["oauth-token"], undefined, undefined).resolves(cliResult);
            try {
                await cfLocal.cfGetTarget();
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(cliResult.stderr);
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
                        "type": "user_provided_service_instance",
                        "credentials": {
                            "user": "user a",
                            "tags": [ "hana", "mono" ]
                        }
                    }
                }, {
                    "entity": {
                        "name": "test_service_name2",
                        "type": "user_provided_service_instance",
                        "credentials": {
                            "user": "user b",
                            "tags": [ "hana2", "mono1" ]
                        },
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
            assert.deepEqual(result[0].credentials.tags, ["hana", "mono"]);
            expect(result[1].label).to.be.equal("test_service_name2");
            expect(result[1].serviceName).to.be.equal("user_provided_service_instance");
            assert.deepEqual(result[1].tags, ["hana", "mongodb"]);
            assert.deepEqual(result[1].credentials.tags, ["hana2", "mono1"]);
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

    describe("cfLogout", () => {
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("logout", async () => {
            cliResult.stdout = ``;
            cliResult.stderr = ``;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(["logout"], undefined, undefined).resolves(cliResult);
            await cfLocal.cfLogout();
        });
    });

    describe("Creation user-provided-service-instances instances", () => {
        const cliResult: CliResult = {
            stdout: `{ "metadata": {}, "entity": { "name": "myInstance" }}`,
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const spaceGuid = "testSpaceGUID";
        const instanceName = "myInstance";
        const data = {
            name: `${instanceName}`,
            space_guid: `${spaceGuid}`
        };

        it("cfCreateUpsInstance - space missing", async () => {
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/user_provided_service_instances", '-d', stringify(data), "-X", "POST"], undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({ instanceName: instanceName }), parse(cliResult.stdout));
        });

        it("cfCreateUpsInstance - space provided", async () => {
            const mySpace = "mySpaceGUID";
            const copyData = _.cloneDeep(data);
            copyData.space_guid = mySpace;
            fsExtraMock.expects("readFile").never();
            cliMock.expects("execute").withExactArgs(["curl", "/v2/user_provided_service_instances", '-d', stringify(copyData), "-X", "POST"], undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({ instanceName: instanceName, space_guid: mySpace }), parse(cliResult.stdout));
        });

        it("cfCreateUpsInstance - space unavailable", async () => {
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUIDI": "${spaceGuid}" }}`);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/user_provided_service_instances", '-d', stringify(data), "-X", "POST"], undefined, undefined).never();
            try {
                await cfLocal.cfCreateUpsInstance({ instanceName: instanceName });
                fail("should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.space_not_set);
            }
        });

        it("cfCreateUpsInstance - more details provided", async () => {
            const cred = { "user": "password" };
            const serviceUrl = "service://location.org";
            const drainUrl = "drain://location.org";
            const tags = ["tag1", "myTag", "mono"];
            const copyData = _.cloneDeep(data);
            _.merge(copyData, 
                { "credentials": cred },
                { "route_service_url": serviceUrl },
                { "syslog_drain_url": drainUrl },
                { "tags": tags },
            );
            fsExtraMock.expects("readFile").withExactArgs(cfLocal.cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            cliMock.expects("execute").withExactArgs(["curl", "/v2/user_provided_service_instances", '-d', stringify(copyData), "-X", "POST"], undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({
                instanceName: instanceName,
                credentials: cred,
                route_service_url: serviceUrl,
                syslog_drain_url: drainUrl,
                tags
            }), parse(cliResult.stdout));
        });

    });
});
