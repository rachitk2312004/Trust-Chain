import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();
  const requestId = req.requestId ?? "-";

  if (process.env.PERF_LOG === "1") {
    console.log(`[perf] requestId=${requestId} START ${req.method} ${req.originalUrl}`);
  }

  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const perf = res.locals.perf;

    if (process.env.PERF_LOG === "1" && perf) {
      const handlerMs = Math.max(0, durationMs - perf.authMs - perf.dbMs);
      const authTag = perf.authCacheHit ? "HIT" : "MISS";
      console.log(
        `[perf] requestId=${requestId} END ${req.method} ${req.originalUrl} ${res.statusCode} total=${durationMs}ms auth=${perf.authMs.toFixed(0)}ms(${authTag}) db=${perf.dbMs.toFixed(0)}ms queries=${perf.dbQueries} handler=${handlerMs.toFixed(0)}ms`,
      );
      for (const [index, query] of perf.queryLog.entries()) {
        console.log(
          `[perf] requestId=${requestId} db#${index + 1} ${query.model}.${query.operation} ${query.durationMs.toFixed(0)}ms`,
        );
      }
      return;
    }

    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
};
