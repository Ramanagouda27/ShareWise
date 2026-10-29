
import { ConditionReport } from '../types/conditionReport';
import { mockStore } from './mock/mockStore';
import { isProductionDataMode } from './resourceService';
import { AppError } from '../lib/errors';

class ConditionReportService {
  async createReport(
    report: Omit<ConditionReport, 'id' | 'createdAt'>
  ): Promise<ConditionReport> {
    if (isProductionDataMode()) {
      // In live mode, condition reports are created by the approved
      // check_in_booking and return_booking RPCs.
      // Do not insert directly into condition_reports.
      void report;

      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        'Live condition reports are created through the booking check-in and return workflows.'
      );
    }

    // Preserve the existing mock-data workflow.
    return mockStore.createConditionReport(report);
  }
}

export const conditionReportService = new ConditionReportService();
