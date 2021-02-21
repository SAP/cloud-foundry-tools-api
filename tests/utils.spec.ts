import { expect, assert } from "chai";
import * as fsextra from "fs-extra";
import * as sinon from "sinon";
import * as os from "os";
import { fail } from "assert";
import { stringify } from "comment-json";
import * as utils from "../src/utils";
import { eFilters, CF_PAGE_SIZE } from "../src/types";
import { messages } from "../src/messages";

describe("Util unit tests", () => {
    let sandbox: any;
    let fsextraMock: any;

    before(() => {
        sandbox = sinon.createSandbox();
    });

    after(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        fsextraMock = sandbox.mock(fsextra);
    });

    afterEach(() => {
        fsextraMock.verify();
    });

    describe("dataContentAsObject", () => {
        it("fsextra.readFile throws error", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").throws(new Error("cannot read the file"));
            const resObj = await utils.dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns empty file", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").resolves("");
            const resObj = await utils.dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns file with json content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").resolves(`{id: 123}`);
            const resObj = await utils.dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns file with valid .env content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").
                resolves(`name = test       ${os.EOL}             port = 8080${os.EOL}                    company = SAP     ${os.EOL}               `);
            const resObj = await utils.dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({ name: "test", port: "8080", company: "SAP" });
        });

        it("fsextra.readFile returns file with dropped line .env content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").
                resolves(`name = test       ${os.EOL}             port = 8080${os.EOL}       organization: DevX${os.EOL}             company = SAP     ${os.EOL}               `);
            const resObj = await utils.dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({ name: "test", port: "8080", company: "SAP" });
        });
    });

    describe("getConfigFileField scope", () => {
        const configFilePath = utils.cfGetConfigFilePath();

        it("ok:: required field found and exists", async () => {
            fsextraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves(`{"name": "testName"}`);
            const result = await utils.cfGetConfigFileField("name");
            expect(result).to.be.equal("testName");
        });

        it("ok:: required field does not exist, undefined value returned", async () => {
            fsextraMock.expects("readFile").withExactArgs(configFilePath, "utf8").resolves("{}");
            const result = await utils.cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });

        it("ok:: failed to read a config file, undefined value returned", async () => {
            fsextraMock.expects("readFile").withExactArgs(configFilePath, "utf8").throws(new Error());
            const result = await utils.cfGetConfigFileField("name");
            expect(result).to.be.undefined;
        });
    });

    describe("getSpaceGuidThrowIfUndefined", () => {

        it("ok:: required field found and exists", async () => {
            const spaceValue = 'space-guid';
            fsextraMock.expects("readFile").withExactArgs(utils.cfGetConfigFilePath(), "utf8").resolves(stringify({ SpaceFields: { GUID: spaceValue } }));
            expect(await utils.getSpaceGuidThrowIfUndefined()).to.be.equal(spaceValue);
        });
        
        it("exception:: unable to read value", async () => {
            fsextraMock.expects("readFile").withExactArgs(utils.cfGetConfigFilePath(), "utf8").resolves(stringify({ }));
            try {
                await utils.getSpaceGuidThrowIfUndefined();
                fail("test should fail");
            } catch (e) {
                expect(e.message).to.be.equal(messages.cf_setting_not_set);
            }
        });
    });

    describe("utilities scope", () => {

        it("ensureQuery:: nothing arg provided", () => {
            assert.deepEqual(utils.ensureQuery(), { filters: [], per_page: CF_PAGE_SIZE });
        });

        it("ensureQuery:: empty object provided", () => {
            assert.deepEqual(utils.ensureQuery({}), { filters: [], per_page: CF_PAGE_SIZE });
        });

        it("ensureQuery:: resolved query provided", () => {
            const query = { filters: [{ key: eFilters.guids, value: 'some-guid-test' }], per_page: CF_PAGE_SIZE };
            assert.deepEqual(utils.ensureQuery(query), query);
        });

        it("padQuery:: verify structure", () => {
            assert.deepEqual(utils.padQuery(utils.ensureQuery(), [{ key: eFilters.app_guids, value: 'app_guids' }]), {
                filters: [{ key: eFilters.app_guids, value: 'app_guids' }], per_page: CF_PAGE_SIZE
            });
        });

        it("getName:: correct structure", () => {
            expect(utils.getName({ name: 'name' })).be.equal('name');
        });

        it("getName:: incorrect structure", () => {
            expect(utils.getName({ name1: 'name' })).be.equal('');
        });

        it("getDescription:: correct structure", () => {
            expect(utils.getDescription({ description: 'description' })).be.equal('description');
        });

        it("getDescription:: incorrect structure", () => {
            expect(utils.getDescription({ label: 'name' })).be.equal('');
        });

        it("getLabel:: correct structure", () => {
            expect(utils.getLabel({ label: 'label' })).be.equal('label');
        });

        it("getLabel:: incorrect structure", () => {
            expect(utils.getLabel({ abel: 'name' })).be.equal('');
        });

        it("getGuid:: correct structure", () => {
            expect(utils.getGuid({ guid: 'guid' })).be.equal('guid');
        });

        it("getGuid:: incorrect structure", () => {
            expect(utils.getGuid({ abel: 'name' })).be.equal('');
        });

        it("getSpaceFieldGUID:: correct structure", () => {
            expect(utils.getSpaceFieldGUID({ GUID: 'GUID' })).be.equal('GUID');
        });

        it("getSpaceFieldGUID:: incorrect structure", () => {
            expect(utils.getSpaceFieldGUID(undefined)).be.equal('');
        });

        it("getOrgGUID:: correct structure", () => {
            expect(utils.getOrgGUID({
                relationships: {
                    organization: {
                        data: {
                            guid: 'guid'
                        }
                    }
                }
            })).be.equal('guid');
        });

        it("getOrgGUID:: incorrect structure", () => {
            expect(utils.getOrgGUID({})).be.equal('');
        });

        it("getTags:: correct structure", () => {
            assert.deepEqual(utils.getTags({ tags: ['tags', 'hana'] }), ['tags', 'hana']);
        });

        it("getTags:: incorrect structure", () => {
            assert.deepEqual(utils.getTags({ tag: ['tags'] }), []);
        });
    });
});
