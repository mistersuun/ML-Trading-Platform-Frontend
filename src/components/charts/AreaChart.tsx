import LineChart, { type LineChartProps, type LineSeries } from './LineChart';

/** LineChart with every series filled down to the baseline. */
export default function AreaChart(props: LineChartProps) {
  const series: LineSeries[] = props.series.map((s) => ({ ...s, area: true }));
  return <LineChart {...props} series={series} />;
}
