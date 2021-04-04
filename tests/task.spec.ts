import { stringify } from "comment-json";
import { SinonSandbox, SinonMock, createSandbox } from "sinon";
import * as fsextra from "fs-extra";
import * as path from "path";
import { saveTaskConfiguration } from "../src/task";


describe('task unit tests', () => {
    let sandbox: SinonSandbox;
    let fsextraMock: SinonMock;

    before(() => {
        sandbox = createSandbox();
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

    describe("saveTaskConfiguration", () => {
        it("fsextra.readFile throws an error", async () => {
            const taskJsonFilePath = path.join("wsPath", ".vscode", "tasks.json");
            fsextraMock.expects("readFile").withExactArgs(taskJsonFilePath, "utf8").throws(new Error("cannot read the file"));
            const taskToSave = { label: "test" };
            fsextraMock.expects("outputFile").withExactArgs(taskJsonFilePath, stringify({ version: "2.0.0", tasks: [taskToSave] }, undefined, "  ")).resolves();
            await saveTaskConfiguration("wsPath", taskToSave);
        });

        it("tasks.json has invalid json content", async () => {
            const taskJsonFilePath = path.join("wsPath", ".vscode", "tasks.json");
            fsextraMock.expects("readFile").withExactArgs(taskJsonFilePath, "utf8").resolves("");
            const taskToSave = { label: "test" };
            fsextraMock.expects("outputFile").withExactArgs(taskJsonFilePath, stringify({ version: "2.0.0", tasks: [taskToSave] }, undefined, "  ")).resolves();
            await saveTaskConfiguration("wsPath", taskToSave);
        });

        it("tasks.json content is empty json", async () => {
            const taskJsonFilePath = path.join("wsPath", ".vscode", "tasks.json");
            fsextraMock.expects("readFile").withExactArgs(taskJsonFilePath, "utf8").resolves("{}");
            const taskToSave = { label: "test" };
            fsextraMock.expects("outputFile").withExactArgs(taskJsonFilePath, stringify({ version: "2.0.0", tasks: [taskToSave] }, undefined, "  ")).resolves();
            await saveTaskConfiguration("wsPath", taskToSave);
        });

        it("tasks.json content has only version property", async () => {
            const taskJsonFilePath = path.join("wsPath", ".vscode", "tasks.json");
            fsextraMock.expects("readFile").withExactArgs(taskJsonFilePath, "utf8").resolves(`{"version": "1.2.3"}`);
            const taskToSave = { label: "test" };
            fsextraMock.expects("outputFile").withExactArgs(taskJsonFilePath, stringify({ version: "1.2.3", tasks: [taskToSave] }, undefined, "  ")).resolves();
            await saveTaskConfiguration("wsPath", taskToSave);
        });

        it("tasks.json content has version property and task", async () => {
            const taskJsonFilePath = path.join("wsPath", ".vscode", "tasks.json");
            fsextraMock.expects("readFile").withExactArgs(taskJsonFilePath, "utf8").resolves(`{"version": "1.2.3", "tasks": [{"label": "test2"}]}`);
            const taskToSave = { label: "test" };
            fsextraMock.expects("outputFile").withExactArgs(taskJsonFilePath, stringify({ version: "1.2.3", tasks: [{ label: "test2" }, taskToSave] }, undefined, "  ")).resolves();
            await saveTaskConfiguration("wsPath", taskToSave);
        });
    });
});
