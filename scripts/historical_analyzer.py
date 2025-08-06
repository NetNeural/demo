#!/usr/bin/env python3
"""
NetNeural Historical Data Analyzer
Tracks project progression and generates historical trend analysis
"""
import os
import sys
import json
import git
from datetime import datetime, timedelta
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional
import matplotlib.pyplot as plt
import pandas as pd
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HistoricalAnalyzer:
    """Analyzes historical project data and generates trend insights."""
    
    def __init__(self, project_path: str, analysis_period: int = 30):
        """Initialize the historical analyzer.
        
        Args:
            project_path: Path to the project repository
            analysis_period: Number of days to analyze (default: 30)
        """
        self.project_path = Path(project_path)
        self.analysis_period = analysis_period
        self.repo = git.Repo(project_path)
        self.historical_data = {}
        
    def collect_git_metrics(self) -> Dict[str, Any]:
        """Collect metrics from Git history."""
        logger.info(f"Collecting Git metrics for last {self.analysis_period} days...")
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=self.analysis_period)
        
        metrics = {
            "analysis_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": self.analysis_period
            },
            "commit_activity": [],
            "file_changes": {},
            "documentation_updates": [],
            "code_quality_indicators": {}
        }
        
        # Analyze commits
        commits = list(self.repo.iter_commits(
            since=start_date,
            until=end_date
        ))
        
        daily_commits = {}
        file_change_freq = {}
        doc_commits = 0
        
        for commit in commits:
            commit_date = datetime.fromtimestamp(commit.committed_date).date()
            daily_commits[str(commit_date)] = daily_commits.get(str(commit_date), 0) + 1
            
            # Analyze changed files
            for file_path in commit.stats.files:
                file_change_freq[file_path] = file_change_freq.get(file_path, 0) + 1
                
                # Check for documentation updates
                if any(doc_pattern in file_path.lower() for doc_pattern in ['readme', 'doc', 'md', '.txt']):
                    doc_commits += 1
                    metrics["documentation_updates"].append({
                        "date": str(commit_date),
                        "file": file_path,
                        "message": commit.message.strip()
                    })
        
        metrics["commit_activity"] = [
            {"date": date, "commits": count} 
            for date, count in sorted(daily_commits.items())
        ]
        
        metrics["file_changes"] = dict(sorted(
            file_change_freq.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:20])  # Top 20 most changed files
        
        metrics["summary"] = {
            "total_commits": len(commits),
            "documentation_commits": doc_commits,
            "unique_files_changed": len(file_change_freq),
            "avg_commits_per_day": len(commits) / self.analysis_period if self.analysis_period > 0 else 0,
            "documentation_focus": (doc_commits / len(commits) * 100) if commits else 0
        }
        
        return metrics
        
    def analyze_documentation_evolution(self) -> Dict[str, Any]:
        """Analyze how documentation has evolved over time."""
        logger.info("Analyzing documentation evolution...")
        
        docs_path = self.project_path / "docs"
        if not docs_path.exists():
            return {"error": "Documentation directory not found"}
        
        evolution = {
            "analysis_date": datetime.now().isoformat(),
            "structure_analysis": {},
            "content_metrics": {},
            "growth_trends": {}
        }
        
        # Analyze current documentation structure
        def analyze_directory(path: Path, prefix=""):
            structure = {}
            for item in path.iterdir():
                if item.is_file() and item.suffix in ['.md', '.txt', '.rst']:
                    try:
                        content = item.read_text(encoding='utf-8')
                        structure[item.name] = {
                            "size_bytes": len(content.encode('utf-8')),
                            "line_count": len(content.splitlines()),
                            "word_count": len(content.split()),
                            "last_modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                        }
                    except Exception as e:
                        logger.warning(f"Could not analyze {item}: {e}")
                elif item.is_dir() and not item.name.startswith('.'):
                    structure[item.name + "/"] = analyze_directory(item, prefix + "  ")
            return structure
        
        evolution["structure_analysis"] = analyze_directory(docs_path)
        
        # Calculate total metrics
        total_files = 0
        total_size = 0
        total_words = 0
        
        def count_metrics(struct):
            nonlocal total_files, total_size, total_words
            for key, value in struct.items():
                if isinstance(value, dict):
                    if "size_bytes" in value:
                        total_files += 1
                        total_size += value["size_bytes"]
                        total_words += value["word_count"]
                    else:
                        count_metrics(value)
        
        count_metrics(evolution["structure_analysis"])
        
        evolution["content_metrics"] = {
            "total_documentation_files": total_files,
            "total_size_bytes": total_size,
            "total_words": total_words,
            "average_file_size": total_size / total_files if total_files > 0 else 0,
            "documentation_density": total_words / 1000  # Words per KB
        }
        
        return evolution
        
    def analyze_project_maturity(self) -> Dict[str, Any]:
        """Analyze project maturity indicators."""
        logger.info("Analyzing project maturity...")
        
        maturity = {
            "analysis_date": datetime.now().isoformat(),
            "maturity_indicators": {},
            "development_stage": "",
            "recommendations": []
        }
        
        # Check various maturity indicators
        indicators = {}
        
        # Documentation maturity
        docs_exist = (self.project_path / "docs").exists()
        readme_exists = any((self.project_path / name).exists() 
                          for name in ["README.md", "readme.md", "README.txt"])
        
        indicators["documentation"] = {
            "score": 0,
            "factors": {
                "readme_present": readme_exists,
                "docs_directory": docs_exist,
                "structured_docs": False,  # Could be enhanced with actual analysis
                "api_documentation": False  # Could be enhanced
            }
        }
        
        # Calculate documentation score
        doc_score = sum(1 for v in indicators["documentation"]["factors"].values() if v)
        indicators["documentation"]["score"] = (doc_score / 4) * 100
        
        # Version control maturity
        try:
            total_commits = len(list(self.repo.iter_commits()))
            branches = len(list(self.repo.branches))
            tags = len(list(self.repo.tags))
            
            indicators["version_control"] = {
                "score": 0,
                "factors": {
                    "commit_history": total_commits > 10,
                    "branching_strategy": branches > 1,
                    "tagged_releases": tags > 0,
                    "regular_commits": total_commits > 50
                }
            }
            
            vc_score = sum(1 for v in indicators["version_control"]["factors"].values() if v)
            indicators["version_control"]["score"] = (vc_score / 4) * 100
            
        except Exception as e:
            logger.warning(f"Could not analyze version control: {e}")
            indicators["version_control"] = {"score": 0, "error": str(e)}
        
        # Project structure maturity
        structure_factors = {
            "config_files": any(f.exists() for f in [
                self.project_path / "package.json",
                self.project_path / "requirements.txt",
                self.project_path / "go.mod",
                self.project_path / "Cargo.toml"
            ]),
            "ci_cd": (self.project_path / ".github" / "workflows").exists(),
            "tests_directory": any((self.project_path / name).exists() 
                                 for name in ["tests", "test", "__tests__"]),
            "proper_gitignore": (self.project_path / ".gitignore").exists()
        }
        
        indicators["project_structure"] = {
            "score": (sum(1 for v in structure_factors.values() if v) / 4) * 100,
            "factors": structure_factors
        }
        
        # Calculate overall maturity score
        scores = [ind.get("score", 0) for ind in indicators.values() if isinstance(ind, dict)]
        overall_score = sum(scores) / len(scores) if scores else 0
        
        # Determine development stage
        if overall_score >= 80:
            stage = "mature"
        elif overall_score >= 60:
            stage = "developing"
        elif overall_score >= 40:
            stage = "early"
        else:
            stage = "initial"
        
        maturity["maturity_indicators"] = indicators
        maturity["overall_score"] = overall_score
        maturity["development_stage"] = stage
        
        # Generate recommendations
        recommendations = []
        if indicators["documentation"]["score"] < 75:
            recommendations.append("Improve documentation coverage and structure")
        if indicators.get("version_control", {}).get("score", 0) < 75:
            recommendations.append("Enhance version control practices (branching, tagging)")
        if indicators["project_structure"]["score"] < 75:
            recommendations.append("Improve project structure and add CI/CD pipeline")
        
        maturity["recommendations"] = recommendations
        
        return maturity
        
    def generate_trend_analysis(self) -> Dict[str, Any]:
        """Generate comprehensive trend analysis."""
        logger.info("Generating trend analysis...")
        
        # Collect all analysis data
        git_metrics = self.collect_git_metrics()
        doc_evolution = self.analyze_documentation_evolution()
        maturity = self.analyze_project_maturity()
        
        trends = {
            "analysis_metadata": {
                "generated_at": datetime.now().isoformat(),
                "analysis_period_days": self.analysis_period,
                "project_path": str(self.project_path)
            },
            "git_activity_trends": git_metrics,
            "documentation_evolution": doc_evolution,
            "project_maturity": maturity,
            "key_insights": [],
            "strategic_recommendations": []
        }
        
        # Generate key insights
        insights = []
        
        if git_metrics.get("summary", {}).get("total_commits", 0) > 0:
            avg_commits = git_metrics["summary"]["avg_commits_per_day"]
            if avg_commits > 1:
                insights.append(f"High development activity: {avg_commits:.1f} commits per day")
            elif avg_commits > 0.5:
                insights.append(f"Moderate development activity: {avg_commits:.1f} commits per day")
            else:
                insights.append(f"Low development activity: {avg_commits:.1f} commits per day")
        
        doc_focus = git_metrics.get("summary", {}).get("documentation_focus", 0)
        if doc_focus > 30:
            insights.append(f"Strong documentation focus: {doc_focus:.1f}% of commits are documentation-related")
        elif doc_focus > 15:
            insights.append(f"Moderate documentation focus: {doc_focus:.1f}% of commits are documentation-related")
        
        maturity_score = maturity.get("overall_score", 0)
        stage = maturity.get("development_stage", "unknown")
        insights.append(f"Project maturity: {stage} stage ({maturity_score:.1f}% maturity score)")
        
        trends["key_insights"] = insights
        
        # Generate strategic recommendations
        recommendations = []
        
        if avg_commits < 0.5:
            recommendations.append("Consider increasing development velocity")
        if doc_focus < 15:
            recommendations.append("Increase focus on documentation maintenance")
        if maturity_score < 60:
            recommendations.append("Prioritize project infrastructure improvements")
        
        recommendations.extend(maturity.get("recommendations", []))
        trends["strategic_recommendations"] = list(set(recommendations))  # Remove duplicates
        
        return trends
        
    def save_analysis_report(self, trends: Dict[str, Any]):
        """Save the trend analysis report."""
        logger.info("Saving trend analysis report...")
        
        # Ensure output directory exists
        output_dir = self.project_path / "docs" / "generated" / "analysis"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate markdown report
        report_content = self._generate_markdown_report(trends)
        report_path = output_dir / f"HISTORICAL_TRENDS_{datetime.now().strftime('%Y%m%d')}.md"
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        # Save raw data as JSON
        json_path = output_dir / f"trend_data_{datetime.now().strftime('%Y%m%d')}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(trends, f, indent=2, default=str)
        
        logger.info(f"Trend analysis saved to {report_path}")
        
    def _generate_markdown_report(self, trends: Dict[str, Any]) -> str:
        """Generate a markdown report from trend analysis."""
        
        metadata = trends["analysis_metadata"]
        git_metrics = trends["git_activity_trends"]
        maturity = trends["project_maturity"]
        
        report = f"""# NetNeural Historical Trend Analysis
*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
*Analysis Period: {metadata['analysis_period_days']} days*

## Executive Summary

This report analyzes the historical progression of the NetNeural project over the last {metadata['analysis_period_days']} days, providing insights into development velocity, documentation evolution, and project maturity trends.

## Key Insights

"""
        
        for insight in trends["key_insights"]:
            report += f"- {insight}\n"
        
        report += f"""

## Development Activity Analysis

### Commit Activity Summary
- **Total Commits:** {git_metrics.get('summary', {}).get('total_commits', 0)}
- **Average Commits/Day:** {git_metrics.get('summary', {}).get('avg_commits_per_day', 0):.1f}
- **Documentation Focus:** {git_metrics.get('summary', {}).get('documentation_focus', 0):.1f}% of commits
- **Files Modified:** {git_metrics.get('summary', {}).get('unique_files_changed', 0)} unique files

### Most Active Files
"""
        
        file_changes = git_metrics.get("file_changes", {})
        for file_path, changes in list(file_changes.items())[:10]:
            report += f"- `{file_path}`: {changes} changes\n"
        
        report += f"""

## Project Maturity Assessment

### Overall Maturity Score: {maturity.get('overall_score', 0):.1f}%
**Development Stage:** {maturity.get('development_stage', 'Unknown').title()}

### Maturity Breakdown
"""
        
        indicators = maturity.get("maturity_indicators", {})
        for category, data in indicators.items():
            if isinstance(data, dict) and "score" in data:
                report += f"- **{category.title()}:** {data['score']:.1f}%\n"
        
        report += f"""

## Documentation Evolution

"""
        
        doc_evolution = trends["documentation_evolution"]
        if "content_metrics" in doc_evolution:
            metrics = doc_evolution["content_metrics"]
            report += f"""### Documentation Metrics
- **Total Files:** {metrics.get('total_documentation_files', 0)}
- **Total Words:** {metrics.get('total_words', 0):,}
- **Average File Size:** {metrics.get('average_file_size', 0):.0f} bytes
- **Documentation Density:** {metrics.get('documentation_density', 0):.1f} words/KB

"""
        
        report += f"""## Strategic Recommendations

"""
        
        for recommendation in trends["strategic_recommendations"]:
            report += f"- {recommendation}\n"
        
        report += f"""

## Methodology

This analysis was conducted using:
- Git repository analysis for commit patterns and file changes
- Documentation structure analysis for content evolution
- Project maturity assessment based on industry best practices
- Trend identification through historical data comparison

## Data Sources

- Git commit history ({metadata['analysis_period_days']} days)
- Project file structure analysis  
- Documentation content metrics
- Development workflow indicators

---
*Next analysis scheduled: {(datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')}*
"""
        
        return report
        
    def run(self):
        """Execute the complete historical analysis."""
        logger.info(f"Starting historical analysis for {self.project_path}")
        
        try:
            # Generate comprehensive trend analysis
            trends = self.generate_trend_analysis()
            
            # Save the analysis report
            self.save_analysis_report(trends)
            
            logger.info("Historical analysis completed successfully")
            
        except Exception as e:
            logger.error(f"Historical analysis failed: {e}")
            sys.exit(1)

def main():
    """Main entry point for the historical analyzer."""
    parser = argparse.ArgumentParser(description="Analyze historical project trends")
    parser.add_argument("--period", type=int, default=30, 
                       help="Analysis period in days (default: 30)")
    parser.add_argument("--project-path", type=str, default=".",
                       help="Path to project repository (default: current directory)")
    
    args = parser.parse_args()
    
    analyzer = HistoricalAnalyzer(args.project_path, args.period)
    analyzer.run()

if __name__ == "__main__":
    main()
