import { ConditionReport } from '../types/conditionReport';
import { mockStore } from './mock/mockStore';
import { isProductionDataMode } from './resourceService';
import { getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

class ConditionReportService {
  async createReport(
    report: Omit<ConditionReport, 'id' | 'createdAt'>
  ): Promise<ConditionReport> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('condition_reports')
        .insert({
          booking_id: report.bookingId,
          resource_id: report.resourceId,
          inspector_id: report.inspectorId,
          inspector_name: report.inspectorName,
          stage: report.stage,
          grade: report.grade,
          notes: report.notes,
        })
        .select()
        .single();

      if (error) {
        throw new AppError('NETWORK_FAILURE', error.message);
      }
      return data as ConditionReport;
    }

    return mockStore.createConditionReport(report);
  }
}

export const conditionReportService = new ConditionReportService();
