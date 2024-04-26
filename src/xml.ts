import { toXML } from 'jstoxml';
import { CopilotUsageResponse } from './run';

export const createXML = (data: CopilotUsageResponse, config?): string => {
  return toXML(data, config);
}
