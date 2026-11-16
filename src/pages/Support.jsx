import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCheck, faLock, faPaperPlane, faPlus, faRotateRight, faTicket } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../context/AuthContext";
import { getCommunityApiToken } from "../api/session";
import "./../style/support-style.css";

const SUPPORT_API_URL = "https://gameonixfav.vercel.app/api/support-request";
const TICKETS_API_URL = "https://gameonixfav.vercel.app/api/auth/wallet-notifications";
const NOTIFICATIONS_UPDATED_EVENT = "wallet-notifications-updated";
const WHATSAPP_URL = "https://wa.link/2od11q";
const MAX_MESSAGE_LENGTH = 1500;
const MAX_REPLY_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 10;
const TOPICS = [
  { value: "order", label: "Order or purchase" },
  { value: "gift-card", label: "Gift card code" },
  { value: "wallet", label: "Wallet top-up" },
  { value: "account", label: "Account access" },
  { value: "other", label: "Something else" },
];

function getTopicLabel(ticket) {
  const details = ticket.details || {};
  return details.topicLabel || TOPICS.find((topic) => topic.value === details.topic)?.label ||
    (ticket.type === "bug_report" ? "Game report" : "Support request");
}

function getTicketMessages(ticket) {
  const details = ticket.details || {};
  if (Array.isArray(details.messages) && details.messages.length) return details.messages;
  return [{
    id: ticket.id,
    author: "user",
    username: ticket.username,
    message: String(details.message || details.description || ticket.message || ""),
    createdAt: ticket.createdAt,
  }];
}

function getTicketStatus(ticket) {
  const stored = String(ticket.details?.status || "").toLowerCase();
  if (stored === "closed") return "closed";
  if (stored === "answered" || ticket.details?.reply) return "answered";
  return "open";
}

export default function Support() {
  const { user, authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [activeTicketId, setActiveTicketId] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [topic, setTopic] = useState("order");
  const [orderId, setOrderId] = useState(String(searchParams.get("order") || "").slice(0, 60));
  const [message, setMessage] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = useCallback(async ({ selectNewest = false, showSpinner = false } = {}) => {
    if (!user) return [];
    if (showSpinner) setRefreshing(true);
    setTicketError("");
    try {
      const token = await getCommunityApiToken();
      const response = await fetch(TICKETS_API_URL, {
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
        credentials: "omit",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.notifications)) {
        throw new Error(data.error || "Unable to load your support tickets.");
      }
      const nextTickets = data.notifications
        .filter((item) => ["support_request", "bug_report"].includes(item.type))
        .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
      setTickets(nextTickets);
      setActiveTicketId((current) => {
        if (selectNewest && nextTickets[0]) return nextTickets[0].id;
        if (current && nextTickets.some((ticket) => ticket.id === current)) return current;
        return nextTickets[0]?.id || "";
      });
      return nextTickets;
    } catch (error) {
      setTicketError(error.message || "Unable to load your support tickets.");
      return [];
    } finally {
      setLoadingTickets(false);
      if (showSpinner) setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoadingTickets(false);
      return undefined;
    }
    void loadTickets();
    const interval = window.setInterval(() => void loadTickets(), 30000);
    const handleUpdated = () => void loadTickets();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    };
  }, [loadTickets, user]);

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) || null,
    [activeTicketId, tickets]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setTicketError("");
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      setTicketError("Add at least " + MIN_MESSAGE_LENGTH + " characters so we can help.");
      return;
    }
    const honeypot = new FormData(event.currentTarget).get("website") || "";
    setSubmitting(true);
    try {
      const token = await getCommunityApiToken();
      const response = await fetch(SUPPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + token },
        credentials: "omit",
        body: JSON.stringify({ topic, orderId: orderId.trim(), message: trimmedMessage, website: honeypot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't create your ticket. Please try again.");
      setMessage("");
      setShowNewTicket(false);
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
      const updated = await loadTickets({ selectNewest: true });
      if (data.ticketId) setActiveTicketId(data.ticketId);
      else if (updated[0]) setActiveTicketId(updated[0].id);
    } catch (error) {
      setTicketError(error.message || "Couldn't create your ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!activeTicket || !replyDraft.trim() || sendingReply) return;
    setSendingReply(true);
    setTicketError("");
    try {
      const token = await getCommunityApiToken();
      const response = await fetch(TICKETS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + token },
        credentials: "omit",
        body: JSON.stringify({ action: "reply-support-thread", notificationId: activeTicket.id, message: replyDraft.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your reply could not be sent.");
      setReplyDraft("");
      await loadTickets();
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    } catch (error) {
      setTicketError(error.message || "Your reply could not be sent.");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <main className="support-page">
      <header className="support-header support-page-heading">
        <div>
          <span className="support-kicker">GAMEONIX HELP CENTER</span>
          <h1>Support tickets</h1>
          <p>Create a ticket, follow every update, and reply in one conversation. For urgent help, contact us on WhatsApp.</p>
        </div>
        {user && <button className="support-new-ticket" type="button" onClick={() => { setShowNewTicket(true); setTicketError(""); }}>
          <FontAwesomeIcon icon={faPlus} /> New Ticket
        </button>}
      </header>

      <div className="support-layout">
        <section className="support-card support-ticket-workspace" aria-label="Support tickets">
          {authLoading ? (
            <div className="support-state" role="status">Checking your account...</div>
          ) : !user ? (
            <div className="support-access">
              <span className="support-access-icon"><FontAwesomeIcon icon={faLock} /></span>
              <h2>Sign in to open a ticket</h2>
              <p>Your ticket history and replies are private to your account.</p>
              <Link className="support-access-link" to="/login" state={{ from: "/support" }}>Sign in <FontAwesomeIcon icon={faArrowRight} /></Link>
            </div>
          ) : (
            <>
              <div className="support-ticket-list">
                <div className="support-ticket-list-heading">
                  <div><span>YOUR INBOX</span><strong>{tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}</strong></div>
                  <button type="button" aria-label="Refresh tickets" onClick={() => void loadTickets({ showSpinner: true })} disabled={refreshing}><FontAwesomeIcon icon={faRotateRight} /></button>
                </div>
                {loadingTickets ? <div className="support-ticket-list-state">Loading tickets...</div> : tickets.length ? tickets.map((ticket) => {
                  const status = getTicketStatus(ticket);
                  return <button type="button" className={"support-ticket-item" + (ticket.id === activeTicketId && !showNewTicket ? " is-active" : "")} key={ticket.id} onClick={() => { setActiveTicketId(ticket.id); setShowNewTicket(false); setTicketError(""); }}>
                    <span className="support-ticket-item-top"><strong>{getTopicLabel(ticket)}</strong><i className={"support-ticket-status is-" + status}>{status}</i></span>
                    <span>{String(ticket.details?.message || ticket.details?.description || ticket.message || "").slice(0, 90)}</span>
                    <small>#{ticket.id.slice(0, 8)} · {new Date(ticket.createdAt).toLocaleDateString()}</small>
                  </button>;
                }) : <div className="support-ticket-list-state"><FontAwesomeIcon icon={faTicket} /><span>No tickets yet.</span></div>}
              </div>

              <div className="support-ticket-detail">
                {ticketError && <p className="support-message is-error" role="alert">{ticketError}</p>}
                {showNewTicket ? (
                  <div className="support-ticket-new">
                    <div className="support-ticket-detail-heading"><div><span>NEW CONVERSATION</span><h2>Open a ticket</h2></div><button type="button" onClick={() => { setShowNewTicket(false); setTicketError(""); }}>Cancel</button></div>
                    <form className="support-form" onSubmit={handleSubmit} noValidate>
                      <div className="support-field"><label htmlFor="support-topic">Topic</label><select id="support-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>{TOPICS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                      <div className="support-field"><label htmlFor="support-order-id">Order ID <span>(optional)</span></label><input id="support-order-id" value={orderId} maxLength={60} autoComplete="off" onChange={(event) => setOrderId(event.target.value)} placeholder="Paste the request ID from My Orders" /></div>
                      <div className="support-field"><label htmlFor="support-email">Account email</label><input id="support-email" type="email" value={user.email || ""} readOnly /></div>
                      <div className="support-field"><label htmlFor="support-message">How can we help?</label><textarea id="support-message" rows={5} maxLength={MAX_MESSAGE_LENGTH} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the issue and what you expected." /><span className="support-char-count">{message.length} / {MAX_MESSAGE_LENGTH}</span></div>
                      <input type="text" name="website" className="support-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                      <button type="submit" className="support-submit" disabled={submitting}><FontAwesomeIcon icon={faPaperPlane} /> {submitting ? "Creating ticket..." : "Create ticket"}</button>
                    </form>
                  </div>
                ) : activeTicket ? (
                  <div className="support-ticket-chat">
                    <header className="support-ticket-detail-heading">
                      <div><span>TICKET #{activeTicket.id.slice(0, 8)} · {getTopicLabel(activeTicket)}</span><h2>{activeTicket.type === "bug_report" ? String(activeTicket.details?.gameTitle || "Game report") : getTopicLabel(activeTicket)}</h2></div>
                      <i className={"support-ticket-status is-" + getTicketStatus(activeTicket)}>{getTicketStatus(activeTicket)}</i>
                    </header>
                    <div className="support-ticket-messages">
                      {getTicketMessages(activeTicket).map((item) => <article className={"support-ticket-message" + (item.author === "admin" ? " from-team" : "")} key={item.id}>
                        <span>{item.author === "admin" ? "GameOnix support" : "You"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}</span><p>{item.message}</p>
                      </article>)}
                    </div>
                    <form className="support-ticket-reply" onSubmit={sendReply}>
                      <label htmlFor="ticket-reply">Reply to this ticket</label><textarea id="ticket-reply" rows={3} maxLength={MAX_REPLY_LENGTH} value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Write your message..." />
                      <div><span>{replyDraft.length} / {MAX_REPLY_LENGTH}</span><button type="submit" disabled={sendingReply || !replyDraft.trim()}><FontAwesomeIcon icon={faPaperPlane} /> {sendingReply ? "Sending..." : "Send reply"}</button></div>
                    </form>
                  </div>
                ) : (
                  <div className="support-ticket-empty"><FontAwesomeIcon icon={faTicket} /><h2>Your support inbox</h2><p>Choose a ticket to read the conversation, or start a new one.</p><button type="button" className="support-new-ticket" onClick={() => setShowNewTicket(true)}><FontAwesomeIcon icon={faPlus} /> New Ticket</button></div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="support-channels">
          <section className="support-whatsapp"><span className="support-whatsapp-icon"><FontAwesomeIcon icon={faWhatsapp} /></span><h2>WhatsApp</h2><p>Prefer WhatsApp? Send screenshots and get order updates directly.</p><a className="support-whatsapp-link" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Contact on WhatsApp <FontAwesomeIcon icon={faArrowRight} /></a></section>
          <section className="support-note"><h2>Ticket updates</h2><ul>
            <li><FontAwesomeIcon icon={faCheck} /> Your replies stay in this private ticket.</li>
            <li><FontAwesomeIcon icon={faCheck} /> We notify you when support answers.</li>
            <li><FontAwesomeIcon icon={faCheck} /> Add an order ID to help us find your purchase.</li>
          </ul></section>
        </aside>
      </div>
    </main>
  );
}
