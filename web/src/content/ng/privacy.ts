import type { LegalDocument } from '../types';

/**
 * Privacy policy for Nigeria, under the headings of the approved design (page 112). Written from what the platform
 * collects and does (Product Specification, Section 15; the API) and the Nigeria Data Protection Act 2023. To be
 * reviewed by the company's lawyer before any real user signs up (docs/DEPLOYMENT.md).
 */
export const privacy: LegalDocument = {
  title: 'Privacy policy',
  updated: '2026-11-10',
  intro:
    'This policy explains what personal information Projectiles Tech Hub Limited (RC 7987623) collects when you use FindHouseQuick, why, who sees it, how long we keep it, and your rights. We are the data controller, which means the company responsible for your information under the Nigeria Data Protection Act 2023.',
  sections: [
    {
      id: 'collect',
      title: 'What we collect',
      blocks: [
        'We collect only what we need to run FindHouseQuick safely.',
        {
          list: [
            'Account details: your name, phone number, email address, a protected form of your password, your country and language, and whether you are a tenant, landlord, agent or scout.',
            'Identity details, when you are verified: your identity number, a selfie and the result of the liveness check, and a photo of an identity document if the first check does not succeed.',
            'For landlords and agents: ownership documents, letters of authority, company details, and the address and position of each property.',
            'Property photos and videos, with the time and place they were taken.',
            'What you do on FindHouseQuick: searches you save, homes you save, messages and call records (not the sound of calls), inspections, reports you make, and answers you give after an inspection.',
            'Your location, when you search "around me". It is used for that search and is not stored unless you choose to save a place.',
            'Device details: the kind of device, an address for sending notifications to it, your network address, and a random device number kept in a cookie on the website.',
          ],
        },
        'The website uses one cookie that is needed for it to work: the device number, which lets us count views fairly and limit copying of listings. We do not use advertising cookies.',
      ],
    },
    {
      id: 'why',
      title: 'Why we collect it',
      blocks: [
        'We use your information for these purposes, and on these lawful grounds:',
        {
          list: [
            'To give you the service you asked for: your account, searches, messages, inspections and listings (performance of our agreement with you).',
            'To check identities, ownership and authority, and so keep fake listings and fraud out (our legitimate interest in a safe platform, and your consent to the identity check).',
            'To monitor messages automatically for phone numbers, bank details and attempts to move a rental off the platform, and to investigate reports (our legitimate interest in protecting users; this is stated in the Terms of use).',
            'To send you codes, alerts and notifications. You choose which notifications you receive and how; security messages cannot be switched off.',
            'To meet our legal duties, such as keeping records the law requires and answering lawful requests from authorities.',
            'To understand and improve FindHouseQuick, using figures that do not identify you where we can.',
          ],
        },
        'We do not sell your personal information. Property photos and videos are different: they are licensed to us by the lister under the Terms of use, and faces, number plates and documents that appear in them are blurred.',
      ],
    },
    {
      id: 'identity',
      title: 'Identity documents',
      blocks: [
        'Identity numbers are stored encrypted, and are shown to staff masked, with only the last four characters visible. We also keep a one-way fingerprint of the number so that one identity cannot be verified on two accounts, and so that a banned person cannot return.',
        'Selfies and photos of identity documents are kept in private storage. They are never shown to other users. Only verification staff who need them can open them, each time giving a reason, and every view is recorded.',
        'The identity check is carried out with an identity checking company, which receives your identity number and selfie for that purpose only.',
        'After verification, identity images are kept only for the period the law requires, then deleted.',
      ],
    },
    {
      id: 'who',
      title: 'Who can see your information',
      blocks: [
        {
          list: [
            'Visitors who are not signed in see listings, but not who the landlord or agent is.',
            'Signed-in users see a lister\'s name, whether they are the landlord or an agent, and their verified badge. A lister sees the name of a tenant who messages them or books an inspection.',
            'Phone numbers stay hidden until an inspection is booked and both sides agree to share them.',
            'The exact address of a property is shown to a tenant only when an inspection is confirmed.',
            'Our staff see what their work needs, within the countries they work on. Their access to documents is recorded.',
            'Companies that work for us receive what they need to do that work: the identity checking company, the companies that send SMS, email and notifications, the calling service, and the companies that host our servers and storage. They act on our instructions and must protect your information.',
            'Authorities, when the law requires it.',
          ],
        },
        'Some of these companies are outside Nigeria. Where information leaves Nigeria, we rely on the safeguards the Nigeria Data Protection Act 2023 allows.',
        'If a tenant shares inspection details with a trusted contact, we send that contact one SMS and do not keep their number.',
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      blocks: [
        {
          list: [
            'Account information: for as long as your account is open.',
            'Identity images: only for the period the law requires after the check, then deleted.',
            'Photos and videos of a closed listing: removed from public view at once, kept privately as verification evidence for a set period, then deleted.',
            'Messages, inspections and reports: for as long as the accounts involved are open, and afterwards for as long as needed to deal with disputes and fraud.',
            'Records of warnings, suspensions and bans: kept so that the same person cannot return after a ban.',
            'Records the law requires us to keep: for the legal period only.',
          ],
        },
        'When you close your account, we delete or anonymise your personal information, except for the records listed above.',
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        'Under the Nigeria Data Protection Act 2023 you have the right to:',
        {
          list: [
            'see the personal information we hold about you and receive a copy of it;',
            'have information that is wrong or incomplete corrected;',
            'have your information deleted, where we have no lawful reason to keep it;',
            'object to, or ask us to limit, how we use your information;',
            'withdraw a consent you gave, without affecting what was done before;',
            'not be subject to a decision made only by automatic means that has a serious effect on you, without a person reviewing it.',
          ],
        },
        'You can see, correct, download and delete your information from your account settings, or by contacting us. We answer within the time the law allows.',
        'If a breach of security puts your information at risk, we will tell the regulator and the people affected within 72 hours of learning of it, as the law requires.',
        'If you are not satisfied with our answer, you may complain to the Nigeria Data Protection Commission.',
      ],
    },
    {
      id: 'dpo',
      title: 'Our Data Protection Officer',
      blocks: ['Projectiles Tech Hub Limited has a Data Protection Officer, who oversees how we handle personal information and answers questions and requests about it. You can reach the Data Protection Officer using the privacy contact below.'],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: ['For any question about this policy or about your information, contact Projectiles Tech Hub Limited (RC 7987623) using the details below or through the Help page. We may update this policy; when a change matters, we tell you in the app or by email before it takes effect.'],
    },
  ],
};
