import WidgetKit
import SwiftUI
import AppIntents

enum WidgetStore {
  static let suite = "group.com.dincey.habitjournal"

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
  @Environment(\.widgetFamily) var family
  var entry: MomentumEntry
  var mode: String { (entry.snap["mode"] as? String) ?? "today" }
  var compact: Bool { family == .systemSmall }
  var rowCap: Int {
    switch family {
    case .systemSmall: return 2
    case .systemMedium: return 4
    default: return 8
    }
  }

  var body: some View {
    switch mode {
    case "streak":
      VStack(spacing: 4) {
        Text("🔥").font(.title)
        Text(String(((entry.snap["streak"] as? [String: Any])?["current"] as? Int) ?? 0)).font(.title.bold())
        if !compact {
          Text("Best \( ((entry.snap["streak"] as? [String: Any])?["best"] as? Int) ?? 0 )").font(.caption).foregroundStyle(.secondary)
        }
      }.frame(maxWidth: .infinity, maxHeight: .infinity)
    case "credits":
      stat(kicker: "✦", big: "HK$\((entry.snap["credits"] as? Int) ?? 0)", sub: "available")
    case "gift":
      if let gift = entry.snap["gift"] as? [String: Any] {
        VStack(spacing: 4) {
          Text((gift["icon"] as? String) ?? "🎁").font(.largeTitle)
          if !compact {
            Text((gift["label"] as? String) ?? "Gift").font(.caption.weight(.bold))
          }
          Text("\((gift["current"] as? Int) ?? 0)/\((gift["target"] as? Int) ?? 0)").font(.caption).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
      } else { stat(kicker: "🎁", big: "—", sub: "No gift goal") }
    case "journal":
      Button(intent: JournalIntent()) {
        VStack(spacing: 8) {
          Text("+").font(.title.bold())
          if !compact { Text("+ journal").font(.caption.weight(.bold)) }
        }
      }.buttonStyle(.plain)
    case "habit":
      list(items: Array(((entry.snap["habits"] as? [[String: Any]]) ?? []).prefix(1)), title: "Habit")
    case "habits":
      list(items: (entry.snap["habits"] as? [[String: Any]]) ?? [], title: "Habits 1–8")
    default:
      list(items: (entry.snap["outstanding"] as? [[String: Any]]) ?? [], title: "Today")
    }
  }

  func stat(kicker: String, big: String, sub: String) -> some View {
    VStack(spacing: 4) {
      Text(kicker).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
      Text(big).font(.title.bold())
      if !compact { Text(sub).font(.caption).foregroundStyle(.secondary) }
    }.frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  func list(items: [[String: Any]], title: String) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      if !compact { Text(title).font(.caption.weight(.bold)) }
      ForEach(Array(items.prefix(rowCap).enumerated()), id: \.offset) { _, h in
        HStack {
          let flex = (h["flex"] as? Bool) ?? false
          Text("\((h["emoji"] as? String) ?? "") \((h["name"] as? String) ?? "")\(flex ? " · Any" : "")").font(.caption)
          Spacer()
          if !compact {
            Text("\((h["count"] as? Int) ?? 0)/\((h["target"] as? Int) ?? 1)").font(.caption2).foregroundStyle(.secondary)
          }
          Button(intent: CompleteHabitIntent(habitId: (h["id"] as? String) ?? "", date: (h["date"] as? String) ?? "")) {
            Text("+").font(.caption.bold())
          }.buttonStyle(.plain)
          Button(intent: ResetHabitIntent(habitId: (h["id"] as? String) ?? "", date: (h["date"] as? String) ?? "")) {
            Text("↺").font(.caption)
          }.buttonStyle(.plain)
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
    .configurationDisplayName("Habit & Journal")
    .description("Today, Habit, Habits 1–8, streak, credits, gift, or + journal.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
