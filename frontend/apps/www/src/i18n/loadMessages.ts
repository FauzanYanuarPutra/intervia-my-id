import type { AbstractIntlMessages } from 'next-intl';

type MessageTree = Record<string, unknown>;

function isMessageTree(value: unknown): value is MessageTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeMessages(base: MessageTree, next: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };

  for (const [key, value] of Object.entries(next)) {
    const current = merged[key];

    if (isMessageTree(current) && isMessageTree(value)) {
      merged[key] = mergeMessages(current, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

const messageLoaders = [
  (locale: string) => import(`@/messages/common/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/about/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/forum/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/home/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/industries/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/login/${locale}.json`).then((module) => module.default),
  (locale: string) => import(`@/messages/register/${locale}.json`).then((module) => module.default),
];

export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const bundles = await Promise.all(messageLoaders.map((load) => load(locale)));

  return bundles.reduce<MessageTree>((accumulator, bundle) => {
    return mergeMessages(accumulator, bundle as MessageTree);
  }, {}) as AbstractIntlMessages;
}
