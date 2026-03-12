"use client";

import dynamic from "next/dynamic";
import type { ChannelType } from "@/types/database";

const ChannelContent = dynamic(
  () => import("./channel-content").then((m) => ({ default: m.ChannelContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col p-4">
        <div className="h-12 rounded-xl bg-secondary/50 animate-pulse mb-4" />
        <div className="flex-1 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/50 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-secondary/50 animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-secondary/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  }
);

interface Props {
  channelId: string;
  channelType: ChannelType;
}

export function ChannelContentDynamic({ channelId, channelType }: Props) {
  return <ChannelContent channelId={channelId} channelType={channelType} />;
}
