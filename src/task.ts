/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { parse, stringify } from "comment-json";

const DEFAULT_TASKS_JSON_CONTENT: any = { version: "2.0.0", tasks: [] };

async function getTaskJsonContentAsJsonObject(taskJsonFilePath: string): Promise<any> {
    try {
        const tasksJsonString = await fs.promises.readFile(taskJsonFilePath, { encoding: "utf8" });
        const tasksJson: any = parse(tasksJsonString);
        return _.assign(DEFAULT_TASKS_JSON_CONTENT, tasksJson);
    } catch (e) {
        // ignore, probably file or folder is missing
        return DEFAULT_TASKS_JSON_CONTENT;
    }
}

export async function saveTaskConfiguration(wsFolderPath: string, configuration: any): Promise<void> {
    const taskJsonFilePath = path.join(wsFolderPath, ".vscode", "tasks.json");
    const tasksJson = await getTaskJsonContentAsJsonObject(taskJsonFilePath);

    const existingTaskindex = tasksJson.tasks.findIndex((task: any) => task.label === configuration.label);
    if (existingTaskindex >= 0) {
        tasksJson.tasks[existingTaskindex] = configuration;
    } else {
        tasksJson.tasks.push(configuration);
    }

    await fs.promises.writeFile(taskJsonFilePath, stringify(tasksJson, undefined, "  "));
}
