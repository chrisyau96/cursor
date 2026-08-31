import WidgetKit
import SwiftUI
import AppIntents

enum WidgetStore {
  static let suite = "group.app.momentum.habits"

  static func snapshot() -> [String: Any] {
    let defaults = UserDefaults(suiteName: suite)
    if let data = defaults?.data(forKey: "widget-snapshot"),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      return obj
    }
    return [:]
  }

  static func enqueue(type: String, habitId: String?, date: String?) {
    let defaults = UserDefaults(suiteName: suite)
    var pending = defaults?.array(forKey: "widget-pending") as? [[String: Any]] ?? []
    var action: [String: Any] = ["type": type, "at": ISO8601DateFormatter().string(from: Date())]
    if let habitId { action["habitId"] = habitId }
    if let date { action["date"] = date }
    pending.append(action)
    defaults?.set(pending, forKey: "widget-pending")
  }
}

struct CompleteHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Complete habit"
  @Parameter(title: "Habit") var habitId: String
  @Parameter(title: "Date") var date: String

  func perform() async throws -> some IntentResult {
    WidgetStore.enqueue(type: "complete", habitId: habitId, date: date)
    return .result()
  }
}

struct ResetHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Reset habit"
  @Parameter(title: "Habit") var habitId: String
  @Parameter(title: "Date") var date: String

  func perform() async throws -> some IntentResult {
    WidgetStore.enqueue(type: "reset", habitId: habitId, date: date)
    return .result()
  }
}

struct JournalIntent: AppIntent {
  static var title: LocalizedStringResource = "Log journal"
  func perform() async throws -> some IntentResult {
    WidgetStore.enqueue(type: "journal", habitId: nil, date: nil)
    return .result()
  }
}

struct MomentumEntry: TimelineEntry {
  let date: Date
  let snap: [String: Any]
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> MomentumEntry {
    MomentumEntry(date: Date(), snap: [:])
  }
  func getSnapshot(in context: Context, completion: @escaping (MomentumEntry) -> Void) {
    completion(MomentumEntry(date: Date(), snap: WidgetStore.snapshot()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MomentumEntry>) -> Void) {
    let entry = MomentumEntry(date: Date(), snap: WidgetStore.snapshot())
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
  }
}

struct MomentumWidgetView: View {
  var entry: MomentumEntry
  var mode: String { (entry.snap["mode"] as? String) ?? "today" }

  var body: some View {
    switch mode {
    case "streak":
      stat(kicker: "Streak", big: String(((entry.snap["streak"] as? [String: Any])?["current"] as? Int) ?? 0), sub: "100% days")
    case "credits":
      stat(kicker: "Credits", big: "HK$\((entry.snap["credits"] as? Int) ?? 0)", sub: "Available")
    case "gift":
      if let gift = entry.snap["gift"] as? [String: Any] {
        stat(kicker: "\((gift["icon"] as? String) ?? "🎁") \((gift["label"] as? String) ?? "Gift")",
             big: "\((gift["current"] as? Int) ?? 0)/\((gift["target"] as? Int) ?? 0)",
             sub: "Next gift")
      } else { stat(kicker: "Gift", big: "—", sub: "No gift goal") }
    case "journal":
      let done = ((entry.snap["journal"] as? [String: Any])?["done"] as? Bool) ?? false
      Button(intent: JournalIntent()) {
        stat(kicker: "Journal", big: done ? "✓" : "✎", sub: done ? "Logged today" : "Tap to log")
      }.buttonStyle(.plain)
    case "habits":
      list(items: (entry.snap["habits"] as? [[String: Any]]) ?? [], due: true)
    default:
      list(items: (entry.snap["outstanding"] as? [[String: Any]]) ?? [], due: false)
    }
  }

  func stat(kicker: String, big: String, sub: String) -> some View {
    VStack(spacing: 4) {
      Text(kicker).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
      Text(big).font(.title.bold())
      Text(sub).font(.caption).foregroundStyle(.secondary)
    }.frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  func list(items: [[String: Any]], due: Bool) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(due ? "Habits due" : "Today").font(.caption.weight(.bold)).foregroundStyle(Color(red: 0.31, green: 0.27, blue: 0.9))
      ForEach(Array(items.prefix(6).enumerated()), id: \.offset) { _, h in
        HStack {
          Text("\((h["emoji"] as? String) ?? "") \((h["name"] as? String) ?? "")").font(.caption)
          Spacer()
          if due {
            Text((h["dueLabel"] as? String) ?? "").font(.caption2).foregroundStyle(.secondary)
          } else {
            Text("\((h["count"] as? Int) ?? 0)/\((h["target"] as? Int) ?? 1)").font(.caption2)
            if !((h["done"] as? Bool) ?? false) {
              Button(intent: CompleteHabitIntent(habitId: (h["id"] as? String) ?? "", date: (h["date"] as? String) ?? "")) {
                Text("+1").font(.caption.bold())
              }.buttonStyle(.plain)
            }
            if ((h["count"] as? Int) ?? 0) > 0 {
              Button(intent: ResetHabitIntent(habitId: (h["id"] as? String) ?? "", date: (h["date"] as? String) ?? "")) {
                Text("↺").font(.caption)
              }.buttonStyle(.plain)
            }
          }
        }
      }
      if items.isEmpty { Text("Nothing outstanding").font(.caption).foregroundStyle(.secondary) }
    }
  }
}

@main
struct MomentumWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumWidget", provider: Provider()) { entry in
      MomentumWidgetView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Momentum")
    .description("Today tasks, selected habits, streak, credits, gift, or journal.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
