"use client";

import { ChannelHeader } from "@/components/chat/channel-header";
import { MessageArea } from "@/components/chat/message-area";
import { MessageInput } from "@/components/chat/message-input";
import { WinningProductShowcase } from "@/components/product/winning-product-showcase";
import type { ChannelType } from "@/types/database";

interface Props {
  channelId: string;
  channelType: ChannelType;
}

export function ChannelContent({ channelId, channelType }: Props) {
  if (channelType === "winning_product") {
    return (
      <div className="flex-1 flex flex-col h-full">
        <ChannelHeader channelId={channelId} />
        <WinningProductShowcase channelId={channelId} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <ChannelHeader channelId={channelId} />
      <MessageArea channelId={channelId} />
      <MessageInput channelId={channelId} />
    </div>
  );
}