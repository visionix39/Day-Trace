import { Desk } from "@/components/Desk";

/**
 * Everything on the page lives in your browser's own SQLite database, so the
 * page itself is just the desk component; it fills in once the database opens.
 */
export default function Home() {
  return <Desk />;
}
