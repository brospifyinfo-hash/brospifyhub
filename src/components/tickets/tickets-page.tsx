"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TicketList } from "./ticket-list";
import { TicketView } from "./ticket-view";
import type { Ticket } from "@/types/database";

interface Props {
  isAdmin?: boolean;
}

export function TicketsPage({ isAdmin }: Props) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Ticket List - Always visible on desktop, hidden when ticket selected on mobile */}
      <div className={`w-full md:w-80 lg:w-96 md:border-r border-border bg-card/50 md:flex-shrink-0 ${
        selectedTicket ? "hidden md:flex md:flex-col" : "flex flex-col flex-1"
      }`}>
        <TicketList 
          isAdmin={isAdmin} 
          onSelectTicket={setSelectedTicket} 
          selectedTicketId={selectedTicket?.id}
        />
      </div>

      {/* Ticket View */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedTicket ? "flex" : "hidden md:flex"}`}>
        {selectedTicket ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTicket.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full flex flex-col"
            >
              <TicketView
                ticket={selectedTicket}
                isAdmin={isAdmin}
                onBack={() => setSelectedTicket(null)}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-6 bg-secondary/20">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <svg 
                className="w-8 h-8 md:w-10 md:h-10 text-muted-foreground" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                />
              </svg>
            </div>
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">
              Kein Ticket ausgewählt
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Wähle ein Ticket aus der Liste aus, um die Konversation anzuzeigen
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
