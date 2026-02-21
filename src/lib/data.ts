import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'astro:content';

const PublicationSchema = z.object({
  title: z.string(),
  authors: z.string(),
  date: z.union([z.string(), z.date()]),
  conference: z.string().optional(),
  paperUrl: z.string().url(),
  codeUrl: z.string().url().optional(),
  info: z.string().optional(),
  selected: z.boolean().optional(),
});

export type Publication = z.infer<typeof PublicationSchema> & {
  date: Date;
};

const WorkExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  from: z.string(),
  to: z.string().optional(),
  url: z.string().url().optional(),
  details: z.union([z.string(), z.array(z.string())]).optional(),
  images: z.array(z.string()).optional(),
});

export type WorkExperienceEntry = Omit<
  z.infer<typeof WorkExperienceSchema>,
  'from' | 'to'
> & {
  from: Date;
  to?: Date;
};

const loadYamlArray = (relativePath: string) => {
  const filePath = path.join(process.cwd(), relativePath);
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);
    if (!Array.isArray(data)) {
      console.warn(`${relativePath} must be a YAML array, got`, typeof data);
      return [];
    }
    return data;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`${relativePath} not found, using empty list`);
      return [];
    }
    console.warn(`Error loading ${relativePath}: ${error.message}`);
    return [];
  }
};

const normalizeDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
};

export const getPublications = (): Publication[] => {
  const raw = loadYamlArray('src/content/publications.yml');
  const publications: Publication[] = [];

  for (const item of raw) {
    const parsed = PublicationSchema.safeParse(item);
    if (!parsed.success) {
      console.warn('Skipping invalid publication entry', parsed.error.format());
      continue;
    }
    const date = normalizeDate(parsed.data.date);
    if (!date) {
      console.warn('Skipping publication with invalid date', parsed.data.title);
      continue;
    }
    publications.push({ ...parsed.data, date });
  }

  return publications.sort((a, b) => b.date.valueOf() - a.date.valueOf());
};

const parseYearMonth = (value: string) => {
  const [year, month] = value.split('-').map((part) => Number(part));
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
};

export const getWorkExperience = (): WorkExperienceEntry[] => {
  const raw = loadYamlArray('src/content/work-experience.yml');
  const work: WorkExperienceEntry[] = [];

  for (const item of raw) {
    const parsed = WorkExperienceSchema.safeParse(item);
    if (!parsed.success) {
      console.warn('Skipping invalid work entry', parsed.error.format());
      continue;
    }
    const from = parseYearMonth(parsed.data.from);
    const to =
      parsed.data.to === undefined ? undefined : parseYearMonth(parsed.data.to);

    if (!from || (parsed.data.to !== undefined && !to)) {
      console.warn('Skipping work entry with invalid dates', parsed.data.title);
      continue;
    }

    work.push({
      ...parsed.data,
      from,
      to,
    });
  }

  return work;
};
