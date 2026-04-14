import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'puppeteer';
import { AppConfig } from '../config/configuration';
import { AvitoMessage } from './avito.types';

const SELECTORS = {
  chatList: '[data-marker="messenger/chats"]',
  chatItem: '[data-marker="messenger/chat"]',
  chatSender: '[data-marker="messenger/chat-title"]',
  chatPreview: '[data-marker="messenger/chat-snippet"]',
  chatLink: 'a[data-marker="messenger/chat"]',
  messageList: '[data-marker="messenger/messages"]',
  messageItem: '[data-marker="messenger/message"]',
  messageText: '[data-marker="messenger/message-text"]',
  messageTime: 'time',
} as const;

interface RawChatEntry {
  sender: string;
  preview: string;
  url: string;
}

interface RawMessage {
  text: string;
  timestamp: string;
}

@Injectable()
export class PollingService {
  private readonly logger = new Logger(PollingService.name);
  private readonly seenMessageIds = new Set<string>();
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  start(
    page: Page,
    targetSender: string,
    onMessage: (msg: AvitoMessage) => void,
    onError: (err: Error) => void,
  ): void {
    const intervalMs = this.configService.get('pollingIntervalMs', {
      infer: true,
    });

    this.logger.log(
      `Starting polling every ${intervalMs}ms for sender: "${targetSender}"`,
    );

    const poll = async (): Promise<void> => {
      if (this.isPolling) return;
      this.isPolling = true;

      try {
        const messages = await this.scrapeNewMessages(page, targetSender);
        messages.forEach(onMessage);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`Polling error: ${error.message}`);
        onError(error);
      } finally {
        this.isPolling = false;
      }
    };

    // Run immediately, then on interval
    void poll();
    this.pollingTimer = setInterval(() => void poll(), intervalMs);
  }

  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.logger.log('Polling stopped');
    }
  }

  private async scrapeNewMessages(
    page: Page,
    targetSender: string,
  ): Promise<AvitoMessage[]> {
    // Reload messenger to get fresh chat list
    await page.reload({ waitUntil: 'networkidle2' }).catch(() => {
      // Non-fatal — page may already be navigating
    });

    await page
      .waitForSelector(SELECTORS.chatList, { timeout: 15_000 })
      .catch(() => {
        throw new Error('Chat list not found — possible session expiry');
      });

    const chats = await this.extractMatchingChats(page, targetSender);

    if (chats.length === 0) {
      this.logger.debug(`No chats found matching sender: "${targetSender}"`);
      return [];
    }

    const newMessages: AvitoMessage[] = [];

    for (const chat of chats) {
      const messages = await this.extractMessagesFromChat(page, chat);
      newMessages.push(...messages);
    }

    return newMessages;
  }

  private async extractMatchingChats(
    page: Page,
    targetSender: string,
  ): Promise<RawChatEntry[]> {
    return page.evaluate(
      (chatItemSel, chatSenderSel, chatPreviewSel, chatLinkSel, target) => {
        const items = Array.from(document.querySelectorAll(chatItemSel));

        return items
          .map((item) => {
            const senderEl = item.querySelector(chatSenderSel);
            const previewEl = item.querySelector(chatPreviewSel);
            const linkEl = item.querySelector(chatLinkSel) as HTMLAnchorElement | null;

            return {
              sender: senderEl?.textContent?.trim() ?? '',
              preview: previewEl?.textContent?.trim() ?? '',
              url: linkEl?.href ?? '',
            };
          })
          .filter((chat) =>
            chat.sender.toLowerCase().includes(target.toLowerCase()),
          );
      },
      SELECTORS.chatItem,
      SELECTORS.chatSender,
      SELECTORS.chatPreview,
      SELECTORS.chatLink,
      targetSender,
    );
  }

  private async extractMessagesFromChat(
    page: Page,
    chat: RawChatEntry,
  ): Promise<AvitoMessage[]> {
    if (!chat.url) return [];

    await page.goto(chat.url, { waitUntil: 'networkidle2', timeout: 20_000 });

    await page
      .waitForSelector(SELECTORS.messageList, { timeout: 15_000 })
      .catch(() => null);

    const rawMessages: RawMessage[] = await page.evaluate(
      (msgItemSel, msgTextSel, msgTimeSel) => {
        const items = Array.from(document.querySelectorAll(msgItemSel));

        return items.map((item) => ({
          text: item.querySelector(msgTextSel)?.textContent?.trim() ?? '',
          timestamp:
            item.querySelector(msgTimeSel)?.getAttribute('datetime') ??
            new Date().toISOString(),
        }));
      },
      SELECTORS.messageItem,
      SELECTORS.messageText,
      SELECTORS.messageTime,
    );

    const newMessages: AvitoMessage[] = [];

    for (const raw of rawMessages) {
      if (!raw.text) continue;

      const id = this.buildMessageId(chat.sender, raw.text, raw.timestamp);

      if (this.seenMessageIds.has(id)) continue;

      this.seenMessageIds.add(id);
      newMessages.push({
        id,
        sender: chat.sender,
        text: raw.text,
        timestamp: new Date(raw.timestamp),
        chatUrl: chat.url,
      });
    }

    return newMessages;
  }

  private buildMessageId(sender: string, text: string, timestamp: string): string {
    // Deterministic ID — same message always produces same ID
    const raw = `${sender}::${timestamp}::${text.slice(0, 64)}`;
    return Buffer.from(raw).toString('base64url');
  }
}
