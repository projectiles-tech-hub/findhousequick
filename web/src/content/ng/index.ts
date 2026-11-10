import type { CountryContent } from '../types';
import { privacy } from './privacy';
import { terms } from './terms';

export const ng: CountryContent = {
  terms,
  privacy,
  // The five common questions of the approved design (page 110), answered from the Product Specification.
  help: [
    {
      id: 'free',
      question: 'Is it free to join?',
      answer: ['Yes. Creating an account, searching, saving homes, setting alerts, messaging and booking inspections are all free. Listing a property is free too. Where we charge for a service, we show the fee before you agree to it.'],
    },
    {
      id: 'inspection',
      question: 'Do I pay to inspect a home?',
      answer: [
        'No. Inspections are always free. Nobody may charge you to view a home listed on FindHouseQuick.',
        'If a landlord or agent asks you to pay for an inspection, report it from the listing with "Report this listing". A confirmed report leads to a warning, then the loss of their verified badge, then suspension.',
      ],
    },
    {
      id: 'checks',
      question: 'How do you check landlords and agents?',
      answer: [
        'Nobody can list a property until we have checked who they are.',
        {
          list: [
            'Identity: their identity number, a selfie and a liveness check.',
            'Landlords: documents showing that they own the property.',
            'Agents: the landlord\'s approval in the app, or a letter of authority that our team confirms with the landlord.',
            'The property: photos and a walkthrough video taken on site through our app, checked against the property\'s location, and compared with every other listing to catch duplicates.',
          ],
        },
        'Where something looks wrong, our team reviews the documents or visits the property before it is listed.',
      ],
    },
    {
      id: 'list',
      question: 'How do I list my property?',
      answer: [
        {
          list: [
            'Create an account as a landlord or an agent, and complete the identity check.',
            'Add the building at its location, then the flat, shop or other unit you are letting.',
            'Take the photos and the walkthrough video with the FindHouseQuick app, room by room.',
            'Enter the rent and every fee, and upload your ownership documents (or, as an agent, get the landlord\'s authority).',
            'Submit. The first listing of a building is reviewed by our team before it goes live.',
          ],
        },
        'Listing is done in the phone app, because the photos and video must be taken on site.',
      ],
    },
    {
      id: 'report',
      question: 'How do I report a fake listing?',
      answer: [
        'Open the listing and choose "Report". Sign in, pick the reason (fake listing, already taken, inspection fee demanded, extra fees demanded, or does not match), and add any details.',
        'Our team reviews every report. Fake listings are removed, and the person who listed them may be warned, lose their verified badge, be suspended or be banned.',
      ],
    },
  ],
};
