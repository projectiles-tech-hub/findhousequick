import type { LegalDocument } from '../types';

/**
 * Terms of use for Nigeria, under the headings of the approved design (page 111). Written in standard terms from what
 * the platform does (Product Specification and Decisions Log). To be reviewed by the company's lawyer before any real
 * user signs up (docs/DEPLOYMENT.md, "Legal and regulatory steps").
 */
export const terms: LegalDocument = {
  title: 'Terms of use',
  updated: '2026-11-10',
  intro:
    'These terms are an agreement between you and Projectiles Tech Hub Limited (RC 7987623), the company that owns and runs FindHouseQuick. By creating an account or using FindHouseQuick, you agree to them. If you do not agree, please do not use FindHouseQuick.',
  sections: [
    {
      id: 'using',
      title: 'Using FindHouseQuick',
      blocks: [
        'FindHouseQuick is a place where tenants find houses, flats, shops, offices and short lets to rent, and where landlords and their agents list them. We are not the landlord, the agent or the tenant, and we are not a party to any tenancy. Each rental is agreed between the tenant and the landlord.',
        'Anyone may search and view listings without an account. You need an account to contact a lister, book an inspection, save homes, set alerts or list a property.',
        'You must be at least 18 years old and able to enter into a binding agreement.',
        'It is free to join and to search. Where we charge for a service, we show the fee before you agree to it.',
        {
          list: [
            'Use FindHouseQuick only for lawful purposes and only for yourself or for someone you have authority to act for.',
            'Do not copy, collect or reuse listings, photos or other content by any automatic means. We limit how many listings one account, device or network address may open.',
            'Do not try to get around our security, our checks or our limits.',
            'Do not harass, threaten, deceive or discriminate unlawfully against another user.',
          ],
        },
        'We may change, pause or withdraw any feature. We may change these terms; when a change matters, we tell you in the app or by email before it takes effect. If you keep using FindHouseQuick after that, you accept the change.',
      ],
    },
    {
      id: 'accounts',
      title: 'Accounts and identity checks',
      blocks: [
        'You open an account with your phone number and email address, and confirm both. Keep your password and sign-in codes to yourself. You are responsible for what is done through your account; tell us at once if you think someone else has used it.',
        'One person may hold one account. The details you give us must be true, and you must keep them up to date.',
        'Before you contact listers, book inspections or list a property, we check your identity. In Nigeria this uses your National Identification Number (NIN), a selfie and a liveness check, carried out with an identity checking company. One identity can be verified on one account only.',
        'Landlords must also show that they own the property, and agents must show that the landlord has given them authority to let it. We may ask for more documents, phone the landlord, or visit the property.',
        'A verified badge means that we carried out these checks. It is not a guarantee about a person or a property. Please still take ordinary care: inspect a home before you pay for it, and never pay anyone before you have seen it.',
      ],
    },
    {
      id: 'listings',
      title: 'Listings',
      blocks: [
        'Only the owner of a property, or an agent with the owner\'s authority, may list it. A listing must describe a real property that is available to rent, at its true location, with photos and video taken at the property through the FindHouseQuick app.',
        'Every listing must show the rent and every fee the tenant will be asked to pay, such as an agency fee, a legal or agreement fee, a caution deposit and a service charge. No fee may be charged that is not shown on the listing.',
        'Listers must keep their listings current: confirm that the property is still available when we ask, and mark it as rented as soon as it is let. Listings that are not confirmed in time are taken down automatically.',
        'We check listings before and after they go live, by automatic checks, by our verification team, and sometimes by visiting. We may hold, edit the visibility of, or remove any listing that we believe is false, duplicated, misleading or against these terms.',
        'We work to keep fake listings out, but we do not own or inspect every property, and we do not promise that every detail of every listing is correct. Tell us about any listing that looks wrong using "Report this listing".',
      ],
    },
    {
      id: 'inspections',
      title: 'Inspections',
      blocks: [
        'Inspections are booked through FindHouseQuick, by choosing one of the times the landlord or agent has offered. The landlord or agent then confirms the time or proposes another.',
        'Inspections are always free. No landlord, agent or other person may charge a tenant to view a property listed on FindHouseQuick. If anyone asks you to pay for an inspection, report it to us from the listing. A confirmed report leads to a warning, then the loss of the verified badge, then suspension.',
        'The exact address of a property is shared with the tenant only when an inspection is confirmed. Do not share it further except with someone you trust for your own safety. The app lets a tenant send the inspection details to a family member or friend.',
        'Please keep to the times you agree, and cancel in the app if you cannot attend. Take ordinary care for your safety when meeting someone you do not know. We are not present at inspections and are not responsible for what happens at them.',
        'After an inspection we may ask both sides whether the property matched its listing and whether it was rented. Honest answers help us keep listings accurate.',
      ],
    },
    {
      id: 'messages',
      title: 'Messages and chat monitoring',
      blocks: [
        'Verified tenants can message and call landlords and agents inside FindHouseQuick. Calls are voice calls over the internet, so neither side sees the other\'s phone number. Phone numbers are shared only after an inspection is booked and both sides agree.',
        'Messages are checked automatically for phone numbers, bank details, email addresses and attempts to move a rental off FindHouseQuick. When something is found, the sender sees a warning and the event is recorded for our trust team. By using chat you agree to this monitoring. Its purpose is to protect users from fraud.',
        'Our staff may read messages when a report, a dispute or a suspected breach of these terms needs to be investigated, and as the law requires.',
        'Do not use messages or calls to send spam, to abuse or threaten anyone, or to ask for any payment that is not shown on the listing.',
      ],
    },
    {
      id: 'media',
      title: 'Photos and videos of properties',
      blocks: [
        'Photos and videos of a property belong to the landlord or agent who made them. By uploading them and accepting these terms, the lister gives Projectiles Tech Hub Limited a worldwide, royalty-free, non-exclusive licence, which we may pass on to others, to:',
        {
          list: [
            'show them on the property\'s own listing, including a cover photo on cards that link to that listing, such as search results and similar homes;',
            'use them to advertise FindHouseQuick itself;',
            'sell them, share them with other companies, and use them to train artificial intelligence;',
            'store, copy, resize, watermark and blur them as needed to do these things.',
          ],
        },
        'We never use a property\'s photos or videos to advertise a different property.',
        'The lister confirms that they have the right to take and upload the photos and videos, and that an occupant of the property has agreed to any photos of the inside of an occupied home.',
        'When a listing is closed, its photos and videos are removed from public view. We keep them privately as verification evidence for a set period, then delete them, except for uses already made under the licence above.',
        'Other users must not copy, download, record or reuse property photos and videos. They carry visible and hidden marks that let us trace a copy. Breaking this rule leads to suspension.',
      ],
    },
    {
      id: 'suspension',
      title: 'Suspension and closing accounts',
      blocks: [
        'If we believe that a user has broken these terms or put other users at risk, we may warn them, remove their verified badge, take down their listings, suspend their account or ban them. A ban is recorded against the person\'s verified identity, so a banned person may not return with a new account.',
        'Examples of what leads to these steps: a false or duplicated listing; listing a property without the owner\'s authority; asking for an inspection fee or for any fee not shown on the listing; false identity or ownership documents; copying photos; and abuse of other users or of our staff.',
        'If you think we made a mistake, contact us and we will review the decision.',
        'You may close your account at any time from your account settings. Some records are kept after an account is closed, where the law requires it or where we need them to prevent fraud; our Privacy policy explains this.',
        'FindHouseQuick is provided as it is. To the extent the law allows, Projectiles Tech Hub Limited is not liable for losses that arise from dealings between users, from a user\'s false statements, or from events outside our reasonable control. Nothing in these terms removes any right you have under consumer protection law that cannot be removed by agreement.',
        'These terms are governed by the laws of the Federal Republic of Nigeria. We will first try to settle any dispute with you by talking. If that fails, the courts of Nigeria have jurisdiction.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: ['For any question about these terms or about FindHouseQuick, contact Projectiles Tech Hub Limited (RC 7987623) using the details below or through the Help page.'],
    },
  ],
};
