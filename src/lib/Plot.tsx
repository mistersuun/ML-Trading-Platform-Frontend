import PlotMod from 'react-plotly.js';

/** react-plotly.js is CommonJS: in the production bundle the import can resolve to the module object
 * ({ default: Component }) instead of the component, which crashes React (#130). Unwrap it once, here. */
const Plot = ((PlotMod as unknown as { default?: typeof PlotMod }).default ?? PlotMod) as typeof PlotMod;
export default Plot;
