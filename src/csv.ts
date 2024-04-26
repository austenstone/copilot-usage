import { Json2CsvOptions, json2csv } from "json-2-csv";
import { CopilotUsageResponse } from "./run";

export const createCSV = (data: CopilotUsageResponse, options?: Json2CsvOptions): string => {
  return json2csv(data, options)
}