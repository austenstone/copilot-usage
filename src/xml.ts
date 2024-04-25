import { toXML } from 'jstoxml';
import { CopilotUsageResponse } from './types';

export const createXML = (data: CopilotUsageResponse, config?): string => {
  return toXML(data, config);
}
