import * as chrono from "chrono-node";

const moddedChrono = chrono.casual.clone();
moddedChrono.refiners.push({
  refine: (context: chrono.ParsingContext, results: chrono.ParsingResult[]) => {
    // If there is no AM/PM (meridiem) specified,
    // usually PM
    results.forEach((result) => {
      const hour = result.start.get('hour') || 0
      if (!result.start.isCertain('meridiem') && hour >= 1 && hour <= 5) {
        result.start.assign('meridiem', 1);
        result.start.assign('hour', hour + 12);
      }

      const year = result.start.get('year') || 0
      if (!result.start.isCertain('year')) {
        result.start.assign('year', new Date().getFullYear())
      } else if (year < 100) {
        result.start.assign('year', year + 2000)
      }
    });
    return results;
  },
});

export default moddedChrono;
