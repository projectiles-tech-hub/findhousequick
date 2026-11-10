import { redirect } from 'next/navigation';

/** The home page (page 106) is not built yet; until it is, the site opens on the search results. */
export default function Home() {
  redirect('/homes');
}
