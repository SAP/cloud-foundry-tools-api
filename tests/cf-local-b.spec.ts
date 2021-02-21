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
import { cfGetConfigFilePath } from "../src/utils";

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

        it("ok:: target - no space targeted", async () => {
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

        it("ok:: target - no space no org targeted", async () => {
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

        it("ok:: full tagret set", async () => {
            cliResult.stdout = `"api endpoint:   ${endpoint}"
            "api version:    ${apiVer}"
            "user:           ${user}"
            "org:            ${org}"
            "space:          ${space}"
            `;
            cliMock.expects("execute").withExactArgs(testArgs, testOptions, undefined).resolves(cliResult);
            const result = await cfLocal.cfGetTarget(true);
            expect(result["api endpoint"]).to.be.equal(endpoint);
            expect(result["api version"]).to.be.equal(apiVer);
            expect(result.user).to.be.equal(user);
            expect(result.org).to.be.equal(org);
            expect(result.space).to.be.equal(space);
        });

        it("exception:: target - error, not logged in", async () => {
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

        it("exception:: target - error", async () => {
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

        it("exception:: target - no space targeted - auth-token expired", async () => {
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
        const spaceGuid = 'testSpaceGUID';
        const cliResult: CliResult = {
            stdout: "",
            stderr: "",
            exitCode: 0,
            error: ""
        };

        it("ok:: instances found, few calls for credentials are wrong", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            const guids = ['guid-1', 'guid-2'];
            const expectedOutput = {
                "resources": [{
                    "name": "test_service_name1",
                    "type": "user-provided",
                    guid: guids[0]
                }, {
                    "name": "test_service_name2",
                    "type": "user_provided_service_instance",
                    "tags": ["hana", "mongodb"],
                    guid: guids[1]
                }]
            };
            const credentialsOutput = {
                user_name: "user",
                pswd: 'pswd'
            };

            cliResult.stdout = stringify(expectedOutput);
            cliMock.expects("execute").withArgs(["curl", `v3/service_instances?space_guids=${spaceGuid}&type=user-provided&per_page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            cliMock.expects("execute").withArgs(["curl", `v3/service_instances/${guids[0]}/credentials`]).resolves({ stdout: stringify(credentialsOutput), exitCode: 0 });
            cliMock.expects("execute").withArgs(["curl", `v3/service_instances/${guids[1]}/credentials`]).resolves({ stdout: stringify({ errors: [{ error: "error" }] }), exitCode: 0 });
            const query: any = {
                page: null,
                'wrongKey': '',
                filters: [
                    { key: eFilters.space_guids, value: spaceGuid }
                ],
                'per_page': CF_PAGE_SIZE
            };
            const result = await cfLocal.cfGetUpsInstances(query);
            expect(result).to.have.lengthOf(2);
            expect(result[0].label).to.be.equal("test_service_name1");
            expect(result[0].serviceName).to.be.equal("user-provided");
            assert.deepEqual(result[0].tags, []);
            assert.deepEqual(result[0].credentials, credentialsOutput);
            expect(result[1].label).to.be.equal("test_service_name2");
            expect(result[1].serviceName).to.be.equal("user-provided");
            assert.deepEqual(result[1].tags, ["hana", "mongodb"]);
            assert.deepEqual(result[1].credentials, {});
        });

        it("ok:: no instances found", async () => {
            cliResult.exitCode = 0;
            cliResult.error = "";
            const expectedOutput = {
                resources: [] as any[]
            };
            cliResult.stdout = stringify(expectedOutput);
            cliMock.expects("execute").withArgs(["curl", `v3/service_instances?space_guids=${spaceGuid}&type=user-provided&per_page=${CF_PAGE_SIZE}`]).resolves(cliResult);
            const query: any = {
                page: null,
                'wrongKey': '',
                filters: [
                    { key: eFilters.space_guids, value: spaceGuid }
                ],
                'per_page': CF_PAGE_SIZE
            };
            expect(await cfLocal.cfGetUpsInstances(query)).to.be.empty;
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

        it("ok:: instance names contains specials chars", async () => {
            cliMock.expects("execute").withExactArgs([
                "bind-local-ups", "-path", filePath, "-service-names", instanceNames[0], "-service-names", instanceNames[1], '-tags', tags[0], '-tags', tags[1]
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

        it("ok:: logout", async () => {
            cliResult.stdout = ``;
            cliResult.stderr = ``;
            cliResult.exitCode = 0;
            cliMock.expects("execute").withExactArgs(["logout"], undefined, undefined).resolves(cliResult);
            await cfLocal.cfLogout();
        });
    });

    describe("cfCreateUpsInstance:: creation user-provided-service-instances instances", () => {
        const cliResult: CliResult = {
            stdout: `{ "metadata": {}, "entity": { "name": "myInstance" }}`,
            stderr: "",
            exitCode: 0,
            error: ""
        };
        const spaceGuid = "testSpaceGUID";
        const instanceName = "myInstance";
        const tags = ["foo", "bar", "baz"];
        const data = {
            name: instanceName,
            type: "user-provided",
            tags: tags,
            relationships: {
                "space": {
                    "data": {
                        "guid": spaceGuid
                    }
                }
            }
        };

        it("ok:: space not provided - default value set", async () => {
            fsExtraMock.expects("readFile").withExactArgs(cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_instances", '-d',
                `{"name":"myInstance","type":"user-provided","relationships":{"space":{"data":{"guid":"testSpaceGUID"}}},"tags":["foo","bar","baz"]}`, "-X", "POST"],
                undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({ instanceName, tags }), parse(cliResult.stdout));
        });

        it("ok:: space value specified", async () => {
            const mySpace = "mySpaceGUID";
            fsExtraMock.expects("readFile").never();
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_instances", '-d',
                `{"name":"myInstance","type":"user-provided","relationships":{"space":{"data":{"guid":"${mySpace}"}}}}`, "-X", "POST"],
                undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({ instanceName: instanceName, space_guid: mySpace }), parse(cliResult.stdout));
        });

        it("exception:: space value not specified, default is unavailable", async () => {
            fsExtraMock.expects("readFile").withExactArgs(cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUIDI": "${spaceGuid}" }}`);
            cliMock.expects("execute").withArgs(["curl", "/v3/service_instances", '-d', "-X", "POST"], undefined, undefined).never();
            try {
                await cfLocal.cfCreateUpsInstance({ instanceName: instanceName });
                fail("should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.cf_setting_not_set);
            }
        });

        it("ok:: more params are provided for instance creation", async () => {
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
            fsExtraMock.expects("readFile").withExactArgs(cfGetConfigFilePath(), "utf8").resolves(`{ "SpaceFields": { "GUID": "${spaceGuid}" }}`);
            cliMock.expects("execute").withExactArgs(["curl", "/v3/service_instances", '-d',
                `{"name":"myInstance","type":"user-provided","relationships":{"space":{"data":{"guid":"testSpaceGUID"}}},"credentials":{"user":"password"},"route_service_url":"service://location.org","syslog_drain_url":"drain://location.org","tags":["tag1","myTag","mono"]}`,
                "-X", "POST"], undefined, undefined).resolves(cliResult);
            assert.deepEqual(await cfLocal.cfCreateUpsInstance({
                instanceName: instanceName,
                credentials: cred,
                route_service_url: serviceUrl,
                syslog_drain_url: drainUrl,
                tags
            }), parse(cliResult.stdout));
        });
    });

    describe('cfGetInstanceCredentials', () => {

        const result = {
            "pagination": {
                "total_results": 1,
                "total_pages": 1,
                "first": {
                    "href": "https://api.example.org/v3/service_credential_bindings?page=1&per_page=2"
                },
                "last": {
                    "href": "https://api.example.org/v3/service_credential_bindings?page=2&per_page=2"
                },
                "next": {
                },
                "previous": {}
            },
            "resources": [
                {
                    "guid": "7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62",
                    "created_at": "2015-11-13T17:02:56Z",
                    "updated_at": "2016-06-08T16:41:26Z",
                    "name": "some-key-name",
                    "type": "key",
                    "last_operation": {
                        "type": "create",
                        "state": "succeeded",
                        "created_at": "2015-11-13T17:02:56Z",
                        "updated_at": "2016-06-08T16:41:26Z"
                    },
                    "metadata": {
                        "annotations": {
                            "foo": "bar"
                        },
                        "labels": {}
                    },
                    "relationships": {
                        "service_instance": {
                            "data": {
                                "guid": "8bfe4c1b-9e18-45b1-83be-124163f31f9e"
                            }
                        }
                    },
                    "links": {
                        "self": {
                            "href": "https://api.example.org/v3/service_credential_bindings/7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62"
                        },
                        "details": {
                            "href": "https://api.example.org/v3/service_credential_bindings/7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62/details"
                        },
                        "service_instance": {
                            "href": "https://api.example.org/v3/service_instances/8bf356j3-9e18-45b1-3333-124163f31f9e"
                        }
                    }
                },
                {
                    "guid": "badbadbad-6ccb-4ef9-ba48-9ce3a91b2b62",
                    "created_at": "2015-11-13T17:02:56Z",
                    "updated_at": "2016-06-08T16:41:26Z",
                    "name": "other-key-name",
                    "type": "key",
                    "last_operation": {
                        "type": "create",
                        "state": "succeeded",
                        "created_at": "2015-11-13T17:02:56Z",
                        "updated_at": "2016-06-08T16:41:26Z"
                    },
                    "metadata": {
                        "annotations": {
                            "foo": "bar"
                        },
                        "labels": {}
                    },
                    "relationships": {
                        "service_instance": {
                            "data": {
                                "guid": "8bfe4c1b-9e18-45b1-83be-124163f31f9e"
                            }
                        }
                    },
                    "links": {
                        "self": {
                            "href": "https://api.example.org/v3/service_credential_bindings/7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62"
                        },
                        "details": {
                            "href": "https://api.example.org/v3/service_credential_bindings/7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62/details"
                        },
                        "service_instance": {
                            "href": "https://api.example.org/v3/service_instances/8bf356j3-9e18-45b1-3333-124163f31f9e"
                        }
                    }
                }
            ]
        };
        const details = {
            "credentials": {
                "connection": "mydb://user@password:example.com"
            },
            "syslog_drain_url": "http://syslog.example.com/drain",
            "volume_mounts": ["/vcap/data", "store"]
        };

        it("ok:: verify result structure", async () => {
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify(result)
            };
            const instanceName = 'instance';
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?names=${instanceName}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[0].guid}/details`], undefined, undefined).resolves({ exitCode: 0, stdout: stringify(details) });
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[1].guid}/details`], undefined, undefined).resolves({ exitCode: 0, stdout: stringify(details) });
            const output = await cfLocal.cfGetInstanceCredentials({ filters: [{ key: eFilters.names, value: instanceName }] });
            expect(_.size(output)).be.equal(2);
            assert.deepEqual(output[0], details);
            assert.deepEqual(output[1], details);
        });

        it("ok:: any of details/parameters call fails", async () => {
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify(result)
            };
            const instanceName = 'instance';
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?names=${instanceName}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[0].guid}/details`], undefined, undefined).resolves({ exitCode: 0, stdout: stringify(details) });
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[1].guid}/details`], undefined, undefined).rejects(new Error('error'));
            const output = await cfLocal.cfGetInstanceCredentials({ filters: [{ key: eFilters.names, value: instanceName }] });
            expect(_.size(output)).be.equal(2);
            assert.deepEqual(output[0], details);
            assert.deepEqual(output[1], {});
        });

        it("ok:: not found", async () => {
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify({
                    resources: [
                    ]
                })
            };
            const instanceName = 'instance';
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?names=${instanceName}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            const output = await cfLocal.cfGetInstanceCredentials({ filters: [{ key: eFilters.names, value: instanceName }] });
            assert.deepEqual(output, []);
        });
    });

    describe('cfGetInstanceKeyParameters', () => {
        const instanceName = 'test-Instance+%$#!Name';
        const instanceGuid = 'test-guid-9876';
        const spaceGuid = 'spaceGuid-10290-3948';
        const output = {
            resources: [{
                name: instanceName,
                guid: instanceGuid,
                last_operation: {
                    state: "succeess"
                }
            }]
        };

        const result = {
            "pagination": {
                "total_results": 1,
                "total_pages": 1,
            },
            "resources": [
                {
                    "guid": "7aa37bad-6ccb-4ef9-ba48-9ce3a91b2b62",
                    "created_at": "2015-11-13T17:02:56Z",
                    "updated_at": "2016-06-08T16:41:26Z",
                    "name": "some-key-name",
                    "type": "key",
                    "metadata": {
                        "annotations": {
                            "foo": "bar"
                        },
                        "labels": {}
                    },
                    "relationships": {
                        "service_instance": {
                            "data": {
                                "guid": "8bfe4c1b-9e18-45b1-83be-124163f31f9e"
                            }
                        }
                    }
                },
                {
                    "guid": "badbadbad-6ccb-4ef9-ba48-9ce3a91b2b62",
                    "created_at": "2015-11-13T17:02:56Z",
                    "updated_at": "2016-06-08T16:41:26Z",
                    "name": "other-key-name",
                    "type": "key",
                    "metadata": {
                        "annotations": {
                            "foo": "bar"
                        },
                        "labels": {}
                    },
                    "relationships": {
                        "service_instance": {
                            "data": {
                                "guid": "8bfe4c1b-9e18-45b1-83be-124163f31f9e"
                            }
                        }
                    }
                }
            ]
        };

        const details = {
            "credentials": {
                "connection": "mydb://user@password:example.com"
            },
            "syslog_drain_url": "http://syslog.example.com/drain",
            "volume_mounts": ["/vcap/data", "store"]
        };

        beforeEach(() => {
            fsExtraMock.expects("readFile").withExactArgs(cfGetConfigFilePath(), "utf8").resolves(`{"SpaceFields": {
                "GUID": "${spaceGuid}"
            }}`);
        });

        it('ok:: verify result structure', async () => {
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify(result)
            };
            cliMock.expects("execute").withExactArgs(["curl",
                `/v3/service_instances?names=${encodeURIComponent(instanceName)}&type=managed&space_guids=${spaceGuid}&per_page=297`], undefined, undefined).resolves({
                    exitCode: 0, stdout: JSON.stringify(output)
                });
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?service_instance_guids=${instanceGuid}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[0].guid}/details`], undefined, undefined).resolves({ exitCode: 0, stdout: stringify(details) });
            const params = await cfLocal.cfGetInstanceKeyParameters(instanceName);
            assert.deepEqual(params, details);
        });

        it('ok:: service key credentials fetching error', async () => {
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify(result)
            };
            cliMock.expects("execute").withExactArgs(["curl",
                `/v3/service_instances?names=${encodeURIComponent(instanceName)}&type=managed&space_guids=${spaceGuid}&per_page=297`], undefined, undefined).resolves({
                    exitCode: 0, stdout: JSON.stringify(output)
                });
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?service_instance_guids=${instanceGuid}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[0].guid}/details`], undefined, undefined).rejects({ exitCode: 0, stdout: stringify({errors: {error: { code: '111'}}}) });
            const params = await cfLocal.cfGetInstanceKeyParameters(instanceName);
            expect(params).be.empty;
        });

        it('exception:: service not found', async () => {
            cliMock.expects("execute").withExactArgs(["curl",
                `/v3/service_instances?names=${encodeURIComponent(instanceName)}&type=managed&space_guids=${spaceGuid}&per_page=297`], undefined, undefined).resolves({
                    exitCode: 0, stdout: JSON.stringify({ resources: [] })
                });
            try {
                await cfLocal.cfGetInstanceKeyParameters(instanceName);
                fail('test should fail');
            } catch (e) {
                expect(e.message).to.equal(messages.service_not_found(instanceName));
            }
        });

        it('ok:: there are not keys, create one', async () => {
            const keysResult = _.cloneDeep(result);
            keysResult.resources = [_.head(keysResult.resources)];
            const cliResult: CliResult = {
                exitCode: 0,
                stderr: "",
                stdout: stringify(keysResult)
            };
            cliMock.expects("execute").withExactArgs(["curl",
                `/v3/service_instances?names=${encodeURIComponent(instanceName)}&type=managed&space_guids=${spaceGuid}&per_page=297`], undefined, undefined).resolves({
                    exitCode: 0, stdout: JSON.stringify(output)
                });
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?service_instance_guids=${instanceGuid}&type=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves({exitCode:0, stdout: '{"resources": []}'});
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings?service_instance_guids=${instanceGuid}&type=key&names=key&per_page=${CF_PAGE_SIZE}`], undefined, undefined).resolves(cliResult);
            cliMock.expects("execute").withExactArgs(['curl', `/v3/service_credential_bindings/${result.resources[0].guid}/details`], undefined, undefined).resolves({ exitCode: 0, stdout: stringify(details) });
            cliMock.expects("execute").withExactArgs(["create-service-key", encodeURIComponent(instanceName), "key"]).resolves();
            const params = await cfLocal.cfGetInstanceKeyParameters(instanceName);
            assert.deepEqual(params, details);
        });
    });

});
