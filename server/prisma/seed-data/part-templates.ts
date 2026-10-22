import type { PartTemplateItem } from '../../src/listings/parts.js';

type Item = Partial<PartTemplateItem> & Pick<PartTemplateItem, 'code' | 'label'>;

/** Parts to photograph for houses and flats (Product Specification, Section 5.3). */
export const RESIDENTIAL_PARTS: Item[] = [
  { code: 'frontage', label: 'Front of building and street' },
  { code: 'compound', label: 'Compound and parking' },
  { code: 'living_room', label: 'Entrance and living room' },
  { code: 'bedroom', label: 'Bedroom', repeat: 'bedrooms' },
  { code: 'bathroom', label: 'Bathroom', repeat: 'bathrooms' },
  { code: 'kitchen', label: 'Kitchen' },
  { code: 'dining', label: 'Dining area', required: false },
  { code: 'balcony', label: 'Balcony', required: false },
  { code: 'store', label: 'Store', required: false },
  { code: 'boys_quarters', label: "Boys' quarters", required: false },
  { code: 'utilities', label: 'Electricity meter, water source and generator area' },
  { code: 'walkthrough', label: 'Walkthrough video', mediaKind: 'VIDEO' },
];

/** A single room, self-contain or hostel room. */
export const ROOM_PARTS: Item[] = [
  { code: 'frontage', label: 'Front of building and street' },
  { code: 'compound', label: 'Compound and parking' },
  { code: 'room', label: 'Room' },
  { code: 'bathroom', label: 'Bathroom', repeat: 'bathrooms' },
  { code: 'kitchen', label: 'Kitchen or cooking area', required: false },
  { code: 'utilities', label: 'Electricity meter, water source and generator area' },
  { code: 'walkthrough', label: 'Walkthrough video', mediaKind: 'VIDEO' },
];

/** Shops, offices, plaza units and warehouses. */
export const COMMERCIAL_PARTS: Item[] = [
  { code: 'frontage', label: 'Frontage and signage position' },
  { code: 'compound', label: 'Compound and parking' },
  { code: 'interior', label: 'Interior', minPhotos: 3 },
  { code: 'toilet', label: 'Toilet', repeat: 'toilets', required: false },
  { code: 'loading_storage', label: 'Loading or storage area', required: false },
  { code: 'utilities', label: 'Electricity meter, water source and generator area' },
  { code: 'walkthrough', label: 'Walkthrough video', mediaKind: 'VIDEO' },
];
