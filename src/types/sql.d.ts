// Raw .sql files are imported as strings (see next.config.ts).
declare module "*.sql" {
  const sql: string;
  export default sql;
}
