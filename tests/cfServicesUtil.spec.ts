/*
 * SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company <alexander.gilin@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as _ from "lodash";
import * as sinon from "sinon";
import * as cfLocal from "../src/cf-local";
import { ServiceInstanceInfo, ITarget, CliResult } from "../src/types";
import * as cli from "../src/cli";
import { getServicesInstancesFilteredByType, getInstanceMetadata, isTargetSet, getInstanceCredentials, createServiceInstance } from "../src/cfServicesUtil";
import { expect, assert } from "chai";
import { fail } from "assert";


describe('services unit package tests', () => {
    let sandbox: any;
    let mockCfLocal: any;
    let mockCli: any;

    before(() => {
        sandbox = sinon.createSandbox();
    });

    after(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        mockCfLocal = sandbox.mock(cfLocal);
        mockCli = sandbox.mock(cli.Cli);
    });

    afterEach(() => {
        mockCfLocal.verify();
        mockCli.verify();
    });

    describe("getServicesInstancesFilteredByType", () => {
        const instances: ServiceInstanceInfo[] = [{ label: "label1", serviceName: "service1" }, { label: "label2", serviceName: "service1" }, { label: "label3", serviceName: "service2" }];

        it("ok", async () => {
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            expect(_.size(await getServicesInstancesFilteredByType(['service1', 'serviceAny']))).to.be.equal(2);
        });

        it("nothing match", async () => {
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            expect(_.size(await getServicesInstancesFilteredByType(['service3', 'serviceAny']))).to.be.equal(0);
        });

        it("undefined types", async () => {
            mockCfLocal.expects("cfGetServiceInstances").resolves(instances);
            expect(_.size(await getServicesInstancesFilteredByType(null))).to.be.equal(0);
        });

        it("thrown exception", async () => {
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
            stdout: `unexpected data output {
                "apiurl": "https://api.authentication.sap.hana.ondemand.com",
                "clientid": "sb-xsuaa_XXXX!t192",
                "clientsecret": "QjBEEFlKyrPbcPHPQLjEy5ElXN4=",
                "identityzone": "devxnew",
                "identityzoneid": "145d56cd-d038-45d1-88ab-c9c7d0c5ebdf",
                "sburl": "https://internal-xsuaa.noauthentication.sap.hana.ondemand.com",
                "tenantid": "145d56cd-d038-45d1-812b-c9c7d0c5ebdf",
                "tenantmode": "mode",
                "uaadomain": "zauthentication.sap.hana.ondemand.com",
                "url": "https://devxnew.authentication.sap.hana.ondemand.com",
                "verificationkey": "-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxJ7mUluDQIDAQAB-----END PUBLIC KEY-----",
                "xsappname": "xsuaa_1595943223466!t192"
            }`,
            stderr: "",
            exitCode: 0
        };

        it("ok", async () => {
            mockCli.expects("execute").withExactArgs(["create-service-key", instanceName, 'key']).resolves();
            mockCli.expects("execute").withExactArgs(["service-key", instanceName, 'key']).resolves(result);
            assert.deepEqual(await getInstanceCredentials(instanceName), JSON.parse(result.stdout.substr(result.stdout.indexOf("{"))));
        });

        it("empty", async () => {
            result.stdout = `{}`;
            mockCli.expects("execute").withExactArgs(["create-service-key", instanceName, 'key']).resolves();
            mockCli.expects("execute").withExactArgs(["service-key", instanceName, 'key']).resolves(result);
            assert.deepEqual(await getInstanceCredentials(instanceName), JSON.parse(result.stdout.substr(result.stdout.indexOf("{"))));
        });

        it("thrown exception", async () => {
            const error = new Error("cfGetTarget failed");
            mockCli.expects("execute").withExactArgs(["create-service-key", instanceName, 'key']).throws(error);
            try {
                await getInstanceCredentials(instanceName);
                fail("should fail");
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
