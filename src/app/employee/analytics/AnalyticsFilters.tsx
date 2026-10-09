import type { StoryMode } from './dashboardModel';

export type DatePreset =
  | 'today'
  | 'custom_day'
  | 'custom_range'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'last_180'
  | 'last_365'
  | 'all_time';

export type CustomerFilter = 'all' | 'paying' | 'priority_pass';

export const DATE_PRESETS: {
  value: DatePreset;
  label: string;
  days?: number;
}[] = [
  { value: 'today', label: 'Today' },
  { value: 'custom_day', label: 'Specific day' },
  { value: 'custom_range', label: 'Date range' },
  { value: 'last_7', label: 'Last 7 days', days: 7 },
  { value: 'last_30', label: 'Last 30 days', days: 30 },
  { value: 'last_90', label: 'Last 3 months', days: 90 },
  { value: 'last_180', label: 'Last 6 months', days: 180 },
  { value: 'last_365', label: 'Last year', days: 365 },
  { value: 'all_time', label: 'All time' },
];

type LocationFilterOption = {
  id: string;
  display_name: string;
};

type AnalyticsFiltersProps = {
  activeLocations: LocationFilterOption[];
  closedLocations: LocationFilterOption[];
  locationId: string;
  datePreset: DatePreset;
  customDateStart: string;
  customDateEnd: string;
  customerType: CustomerFilter;
  storyMode: StoryMode | null;
  resolvedWindowLabel: string;
  comparisonChipLabel: string;
  selectedLocationIsClosed: boolean;
  onLocationChange: (value: string) => void;
  onDatePresetChange: (value: DatePreset) => void;
  onCustomDateStartChange: (value: string) => void;
  onCustomDateEndChange: (value: string) => void;
  onCustomerTypeChange: (value: CustomerFilter) => void;
};

const selectClassName =
  'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100';

export function AnalyticsFilters({
  activeLocations,
  closedLocations,
  locationId,
  datePreset,
  customDateStart,
  customDateEnd,
  customerType,
  storyMode,
  resolvedWindowLabel,
  comparisonChipLabel,
  selectedLocationIsClosed,
  onLocationChange,
  onDatePresetChange,
  onCustomDateStartChange,
  onCustomDateEndChange,
  onCustomerTypeChange,
}: AnalyticsFiltersProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Analytics Filters
        </h2>
        {storyMode ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            {storyMode === 'single_day'
              ? 'Hourly operating view'
              : storyMode === 'multi_day'
                ? 'Daily operating view'
                : 'Trend operating view'}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <label className="text-sm">
          Location scope
          <select
            className={selectClassName}
            value={locationId}
            onChange={(event) => onLocationChange(event.target.value)}
          >
            <option value="all">All active locations</option>
            <optgroup label="Active locations">
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.display_name}
                </option>
              ))}
            </optgroup>
            {closedLocations.length ? (
              <optgroup label="Closed locations — historical">
                {closedLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.display_name} (Closed)
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <label className="text-sm">
          Time window
          <select
            className={selectClassName}
            value={datePreset}
            onChange={(event) =>
              onDatePresetChange(event.target.value as DatePreset)
            }
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Customer segment
          <select
            className={selectClassName}
            value={customerType}
            onChange={(event) =>
              onCustomerTypeChange(event.target.value as CustomerFilter)
            }
          >
            <option value="all">All customers</option>
            <option value="paying">Paying</option>
            <option value="priority_pass">Priority Pass</option>
          </select>
        </label>
      </div>

      {datePreset === 'custom_day' || datePreset === 'custom_range' ? (
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="text-sm">
            {datePreset === 'custom_day' ? 'Day' : 'Start date'}
            <input
              className={selectClassName}
              type="date"
              value={customDateStart}
              onChange={(event) => onCustomDateStartChange(event.target.value)}
            />
          </label>
          {datePreset === 'custom_range' ? (
            <label className="text-sm">
              End date
              <input
                className={selectClassName}
                type="date"
                min={customDateStart || undefined}
                value={customDateEnd}
                onChange={(event) => onCustomDateEndChange(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          Window: {resolvedWindowLabel}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          {comparisonChipLabel}
        </span>
      </div>

      {selectedLocationIsClosed ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Closed location — historical reporting only
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            This location is excluded from active-location totals and
            comparisons. Its settled history remains available for past-period
            reporting.
          </p>
        </div>
      ) : null}
    </>
  );
}
