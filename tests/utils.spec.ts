import { expect } from "chai";
import * as fsextra from "fs-extra";
import * as sinon from "sinon";
import * as os from "os";
import { dataContentAsObject } from "../src/utils";


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
            const resObj = await dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns empty file", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").resolves("");
            const resObj = await dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns file with json content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").resolves(`{id: 123}`);
            const resObj = await dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({});
        });

        it("fsextra.readFile returns file with valid .env content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").
            resolves(`name = test       ${os.EOL}             port = 8080${os.EOL}                    company = SAP     ${os.EOL}               `);
            const resObj = await dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({name: "test", port: "8080", company: "SAP"});
        });

        it("fsextra.readFile returns file with dropped line .env content", async () => {
            fsextraMock.expects("readFile").withExactArgs(".env", "utf8").
            resolves(`name = test       ${os.EOL}             port = 8080${os.EOL}       organization: DevX${os.EOL}             company = SAP     ${os.EOL}               `);
            const resObj = await dataContentAsObject(".env");
            expect(resObj).to.be.deep.equal({name: "test", port: "8080", company: "SAP"});
        });
    });
});
