import { dial, site } from '@/lib/site';

/** The contact details set for this server; shown at the end of the legal pages. */
export function ContactDetails({ privacy = false }: { privacy?: boolean }) {
  const email = privacy ? site.privacyEmail : site.email;
  if (!email && !site.phone && !site.companyAddress) return null;
  return (
    <ul>
      {email && (
        <li>
          {privacy ? 'Privacy and the Data Protection Officer' : 'Email'}: <a href={`mailto:${email}`}>{email}</a>
        </li>
      )}
      {site.phone && (
        <li>
          Phone: <a href={`tel:${dial(site.phone)}`}>{site.phone}</a>
        </li>
      )}
      {site.companyAddress && <li>Address: Projectiles Tech Hub Limited, {site.companyAddress}</li>}
    </ul>
  );
}
