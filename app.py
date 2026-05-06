from __future__ import annotations

import re
from collections.abc import Iterable
from io import BytesIO
from textwrap import shorten

import pandas as pd
import plotly.express as px
import streamlit as st


REQUIRED_COLUMNS = [
    "Item #",
    "Project Type",
    "Status",
    "Summary",
    "Current Flow",
    "Opportunity to Improve",
    "Proposed Tools",
    "Impact",
    "Impact Score",
    "Solution Effort Score",
    "Involved Dept",
    "Discussion Dept",
]

SAMPLE_DATA = [
    {
        "Item #": 1,
        "Project Type": "Quick Win",
        "Status": "To Be",
        "Summary": "DOA supplier contact list should be centralized so CS can route supplier follow-up without searching responsible owners manually.",
        "Current Flow": "1. Trigger: customer reports DOA / product issue requiring supplier confirmation or onsite follow-up.\n2. CS / Guangzhou contact centre checks case details and supporting materials, e.g. video or customer description.\n3. CS needs to identify responsible supplier / brand contact.\n4. Current supplier contacts may be stored separately by Trading, account managers, or different teams.\n5. CS may need to ask Trading / related owner who to contact.\n6. CS then emails supplier and waits for reply before updating customer.",
        "Opportunity to Improve": "Supplier contact ownership is scattered.\nCS spends time finding the correct supplier contact before actioning the case.\nA shared contact list with brand, supplier, contact person, service scope, and escalation owner can reduce routing time.",
        "Proposed Tools": "Microsoft Forms\nPower Automate",
        "Impact": "Man-hours: N/A\nVolume: DOA is mentioned as top case type.\nBusiness impact: supplier response delay / customer waiting time / repeated internal enquiry.",
        "Impact Score": 3,
        "Solution Effort Score": 2,
        "Involved Dept": "1. Customer Service\n2. Trading\n3. Suppliers\n4. Store Operations",
        "Discussion Dept": "CS",
    },
    {
        "Item #": 2,
        "Project Type": "Quick Win",
        "Status": "Planned",
        "Summary": "EW T&C / warranty entitlement reply support can be built into CIAO by using order number, phone number, or EW SKU lookup.",
        "Current Flow": "1. Trigger: customer asks whether their extended warranty / EW plan covers a specific issue.\n2. CS currently checks customer order, EW SKU, plan terms, and applicable T&C manually.\n3. Some T&C cannot be fully displayed on public website because EW terms are broad and plan-specific.\n4. Planned direction: place T&C / reference files into CIAO / knowledge source.\n5. CS inputs phone number, order number, or EW SKU.\n6. CIAO drafts the relevant answer for CS to review and send.",
        "Opportunity to Improve": "EW questions are repetitive but require accurate plan-specific wording.\nPublic website content is not enough to answer detailed customer scenarios.\nA controlled knowledge base can reduce manual search while keeping human review.",
        "Proposed Tools": "Copilot Agent\nSystem Enhancement",
        "Impact": "Man-hours: N/A\nFrequency: recurring EW customer enquiries.\nBusiness impact: faster customer reply / lower wrong-answer risk / better warranty explanation consistency.",
        "Impact Score": 3,
        "Solution Effort Score": 2,
        "Involved Dept": "1. Customer Service\n2. Service Team\n3. IT / AI Team",
        "Discussion Dept": "CS",
    },
    {
        "Item #": 3,
        "Project Type": "Quick Win",
        "Status": "To Be",
        "Summary": "Daily no-stock / ETA report actions can trigger standard SMS/email drafts instead of CS manually preparing customer messages.",
        "Current Flow": "1. Trigger: Supply Chain / warehouse updates daily report for no-stock, delayed stock, ETA, or pick-fail cases.\n2. CS opens the report around 4:30pm or when updated.\n3. CS checks case status and determines customer communication.\n4. If new ETA exists, CS updates SMP delivery date and informs customer.\n5. If no stock or discount/refund case, CS cancels/refunds and sends customer message.\n6. CS manually prepares message wording and tracks follow-up.",
        "Opportunity to Improve": "Many actions are rule-based once status is known.\nCS still manually checks report and sends similar customer messages.\nStandard customer notification can be generated from report status and ETA fields.",
        "Proposed Tools": "Power Automate\nPower BI",
        "Impact": "Man-hours: no exact total mentioned, but daily repeated report handling is required.\nFrequency: daily.\nBusiness impact: customer notification delay / repeated message preparation / missed follow-up risk.",
        "Impact Score": 4,
        "Solution Effort Score": 2,
        "Involved Dept": "1. Customer Service\n2. Supply Chain\n3. Warehouse",
        "Discussion Dept": "CS",
    },
]


def split_multivalue_cell(value: object) -> list[str]:
    """Normalize numbered, bulleted, newline, comma, or semicolon separated cells."""
    if pd.isna(value):
        return []

    text = str(value).strip()
    if not text:
        return []

    text = text.replace("\r", "\n").replace("\u2022", "\n")
    parts = re.split(r"\n+|;|,", text)
    cleaned_parts: list[str] = []

    for part in parts:
        cleaned = re.sub(r"^\s*(?:\d+[\).\-\s]+|[-*]\s*)", "", part).strip()
        if cleaned:
            cleaned_parts.append(cleaned)

    return cleaned_parts or [text]


def unique_sorted(values: Iterable[str]) -> list[str]:
    return sorted({value for value in values if value})


@st.cache_data(show_spinner=False)
def normalize_data(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()
    df.columns = [str(column).strip() for column in df.columns]

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise ValueError(f"Missing required column(s): {missing}")

    df = df[REQUIRED_COLUMNS].copy()
    df = df.dropna(how="all")

    for score_column in ["Impact Score", "Solution Effort Score"]:
        df[score_column] = pd.to_numeric(df[score_column], errors="coerce").clip(0, 5)

    for text_column in [
        "Project Type",
        "Status",
        "Summary",
        "Current Flow",
        "Opportunity to Improve",
        "Proposed Tools",
        "Impact",
        "Involved Dept",
        "Discussion Dept",
    ]:
        df[text_column] = df[text_column].fillna("").astype(str).str.strip()

    df["Item #"] = df["Item #"].fillna("").astype(str).str.strip()
    df["Score Gap"] = df["Impact Score"] - df["Solution Effort Score"]
    df["Priority Score"] = df["Impact Score"] * (6 - df["Solution Effort Score"])
    df["Summary Label"] = df["Summary"].apply(lambda value: shorten(value, width=52, placeholder="..."))
    df["Tool List"] = df["Proposed Tools"].apply(split_multivalue_cell)
    df["Involved Dept List"] = df["Involved Dept"].apply(split_multivalue_cell)
    df["Discussion Dept List"] = df["Discussion Dept"].apply(split_multivalue_cell)
    df["All Dept List"] = [
        unique_sorted(involved + discussion)
        for involved, discussion in zip(df["Involved Dept List"], df["Discussion Dept List"])
    ]
    df["Departments"] = df["All Dept List"].apply(lambda values: ", ".join(values))
    df["Tools"] = df["Tool List"].apply(lambda values: ", ".join(values))

    return df


def read_excel(uploaded_file: BytesIO | None) -> pd.DataFrame:
    if uploaded_file is None:
        return pd.DataFrame(SAMPLE_DATA)

    return pd.read_excel(uploaded_file)


def filter_data(df: pd.DataFrame) -> pd.DataFrame:
    st.sidebar.header("Filters")

    departments = unique_sorted(department for row in df["All Dept List"] for department in row)
    statuses = unique_sorted(df["Status"])
    project_types = unique_sorted(df["Project Type"])
    tools = unique_sorted(tool for row in df["Tool List"] for tool in row)

    selected_departments = st.sidebar.multiselect("Department", departments)
    selected_statuses = st.sidebar.multiselect("Status", statuses)
    selected_project_types = st.sidebar.multiselect("Project type", project_types)
    selected_tools = st.sidebar.multiselect("Proposed tool", tools)
    min_impact, max_impact = st.sidebar.slider("Impact score", 0, 5, (0, 5))
    min_effort, max_effort = st.sidebar.slider("Solution effort score", 0, 5, (0, 5))

    filtered = df.copy()
    if selected_departments:
        filtered = filtered[
            filtered["All Dept List"].apply(
                lambda row: bool(set(selected_departments).intersection(row))
            )
        ]
    if selected_statuses:
        filtered = filtered[filtered["Status"].isin(selected_statuses)]
    if selected_project_types:
        filtered = filtered[filtered["Project Type"].isin(selected_project_types)]
    if selected_tools:
        filtered = filtered[
            filtered["Tool List"].apply(lambda row: bool(set(selected_tools).intersection(row)))
        ]

    filtered = filtered[
        filtered["Impact Score"].between(min_impact, max_impact, inclusive="both")
        & filtered["Solution Effort Score"].between(min_effort, max_effort, inclusive="both")
    ]

    return filtered


def render_kpis(df: pd.DataFrame) -> None:
    total_projects = len(df)
    quick_wins = int((df["Project Type"].str.casefold() == "quick win").sum())
    avg_impact = df["Impact Score"].mean()
    avg_effort = df["Solution Effort Score"].mean()
    high_value = int(((df["Impact Score"] >= 4) & (df["Solution Effort Score"] <= 2)).sum())

    kpi_1, kpi_2, kpi_3, kpi_4, kpi_5 = st.columns(5)
    kpi_1.metric("Projects", total_projects)
    kpi_2.metric("Quick wins", quick_wins)
    kpi_3.metric("Avg. impact", f"{avg_impact:.1f}" if pd.notna(avg_impact) else "N/A")
    kpi_4.metric("Avg. effort", f"{avg_effort:.1f}" if pd.notna(avg_effort) else "N/A")
    kpi_5.metric("High impact / low effort", high_value)


def render_scatter(df: pd.DataFrame) -> None:
    st.subheader("Impact vs. solution effort")
    scatter_df = df.dropna(subset=["Impact Score", "Solution Effort Score"]).copy()

    if scatter_df.empty:
        st.info("No rows have both Impact Score and Solution Effort Score values.")
        return

    fig = px.scatter(
        scatter_df,
        x="Solution Effort Score",
        y="Impact Score",
        color="Project Type",
        symbol="Status",
        size="Priority Score",
        size_max=30,
        text="Summary Label",
        hover_name="Summary",
        hover_data={
            "Item #": True,
            "Status": True,
            "Project Type": True,
            "Impact Score": ":.1f",
            "Solution Effort Score": ":.1f",
            "Priority Score": ":.1f",
            "Departments": True,
            "Summary Label": False,
        },
    )
    fig.update_traces(textposition="top center", marker={"opacity": 0.82})
    fig.update_xaxes(range=[-0.2, 5.2], dtick=1, title="Solution effort score")
    fig.update_yaxes(range=[-0.2, 5.2], dtick=1, title="Impact score")
    fig.add_shape(
        type="rect",
        x0=-0.2,
        x1=2.5,
        y0=3.5,
        y1=5.2,
        fillcolor="rgba(0, 176, 80, 0.08)",
        line={"width": 0},
        layer="below",
    )
    fig.add_annotation(
        x=1.15,
        y=4.85,
        text="Best quick-win zone",
        showarrow=False,
        font={"size": 12, "color": "#18763a"},
    )
    fig.update_layout(height=620, margin={"l": 20, "r": 20, "t": 30, "b": 20})
    st.plotly_chart(fig, use_container_width=True)


def render_extra_charts(df: pd.DataFrame) -> None:
    st.subheader("Project mix and ownership")
    left, right = st.columns(2)

    with left:
        status_counts = (
            df.groupby(["Project Type", "Status"], dropna=False)
            .size()
            .reset_index(name="Projects")
            .sort_values("Projects", ascending=False)
        )
        if status_counts.empty:
            st.info("No project/status data to chart.")
        else:
            fig = px.bar(
                status_counts,
                x="Status",
                y="Projects",
                color="Project Type",
                barmode="group",
                text_auto=True,
                title="Projects by status and type",
            )
            fig.update_layout(height=420, margin={"l": 20, "r": 20, "t": 50, "b": 20})
            st.plotly_chart(fig, use_container_width=True)

    with right:
        dept_rows = df[["Project Type", "All Dept List"]].explode("All Dept List")
        dept_rows = dept_rows.rename(columns={"All Dept List": "Department"})
        dept_counts = (
            dept_rows.dropna(subset=["Department"])
            .groupby(["Department", "Project Type"], dropna=False)
            .size()
            .reset_index(name="Projects")
            .sort_values("Projects", ascending=False)
        )
        if dept_counts.empty:
            st.info("No department data to chart.")
        else:
            fig = px.bar(
                dept_counts,
                x="Projects",
                y="Department",
                color="Project Type",
                orientation="h",
                text_auto=True,
                title="Projects by department",
            )
            fig.update_layout(
                height=420,
                yaxis={"categoryorder": "total ascending"},
                margin={"l": 20, "r": 20, "t": 50, "b": 20},
            )
            st.plotly_chart(fig, use_container_width=True)

    tool_rows = df[["Status", "Tool List"]].explode("Tool List")
    tool_rows = tool_rows.rename(columns={"Tool List": "Tool"})
    tool_counts = (
        tool_rows.dropna(subset=["Tool"])
        .groupby(["Tool", "Status"], dropna=False)
        .size()
        .reset_index(name="Projects")
        .sort_values("Projects", ascending=False)
    )
    if not tool_counts.empty:
        fig = px.bar(
            tool_counts,
            x="Projects",
            y="Tool",
            color="Status",
            orientation="h",
            text_auto=True,
            title="Proposed tools by project status",
        )
        fig.update_layout(
            height=420,
            yaxis={"categoryorder": "total ascending"},
            margin={"l": 20, "r": 20, "t": 50, "b": 20},
        )
        st.plotly_chart(fig, use_container_width=True)


def render_project_table(df: pd.DataFrame) -> None:
    st.subheader("Filtered project table")
    st.caption("Use the sidebar department filter to focus on CS, Trading, Warehouse, suppliers, or any other owner.")

    columns = [
        "Item #",
        "Project Type",
        "Status",
        "Summary",
        "Impact Score",
        "Solution Effort Score",
        "Score Gap",
        "Priority Score",
        "Departments",
        "Tools",
        "Opportunity to Improve",
    ]
    display_df = df[columns].sort_values(
        ["Priority Score", "Impact Score", "Solution Effort Score"],
        ascending=[False, False, True],
    )

    st.dataframe(display_df, use_container_width=True, hide_index=True)

    csv = display_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download filtered table as CSV",
        data=csv,
        file_name="filtered_project_dashboard.csv",
        mime="text/csv",
    )


def main() -> None:
    st.set_page_config(page_title="Project Opportunity Dashboard", layout="wide")

    st.title("Project Opportunity Dashboard")
    st.write(
        "Upload the Excel project list to quickly identify quick wins, high-impact projects, "
        "department ownership, and tool opportunities."
    )

    uploaded_file = st.file_uploader("Upload Excel file (.xlsx or .xls)", type=["xlsx", "xls"])
    if uploaded_file is None:
        st.info("Showing the built-in sample data. Upload your Excel file to analyze the full list.")

    try:
        raw_df = read_excel(uploaded_file)
        df = normalize_data(raw_df)
    except Exception as exc:
        st.error(str(exc))
        st.stop()

    filtered_df = filter_data(df)

    if filtered_df.empty:
        st.warning("No projects match the selected filters.")
        return

    render_kpis(filtered_df)
    render_scatter(filtered_df)
    render_extra_charts(filtered_df)
    render_project_table(filtered_df)


if __name__ == "__main__":
    main()
