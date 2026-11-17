export const eventCategories = [
  "Conference",
  "Workshop",
  "Meetup",
  "Webinar",
  "Party",
  "Other",
];

export type EventFormValues = {
  title?: string;
  description?: string;
  category?: string;
  venue?: string;
  date?: string;
  time?: string;
  capacity?: string;
  visibility?: string;
};

export type EventFormState =
  | {
      error?: string;
      values?: EventFormValues;
    }
  | undefined;
