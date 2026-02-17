#!/usr/bin/env python3
"""
NetNeural Documentation State Monitor
Continuously monitors documentation alignment with project reality
"""

import os
import json
import yaml
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any
import subprocess
import re

class DocumentationStateMonitor:
    def __init__(self, config_path: str = "ai_blueprint_config.yaml"):
        """Initialize the documentation state monitor"""
        self.config = self.load_config(config_path)
        self.base_path = Path(self.config['project']['base_path'])
        self.docs_path = self.base_path / "docs"
        self.history_path = self.docs_path / "generated" / "analysis" / "history"
        self.history_path.mkdir(exist_ok=True)
        
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    
    def scan_repository_state(self) -> Dict[str, Any]:
        """Scan current repository state and collect metrics"""
        state = {
            'timestamp': datetime.now().isoformat(),
            'technical_metrics': self.collect_technical_metrics(),
            'business_metrics': self.collect_business_metrics(),
            'project_metrics': self.collect_project_metrics(),
            'documentation_health': self.assess_documentation_health()
        }
        return state
    
    def collect_technical_metrics(self) -> Dict[str, Any]:
        """Collect technical project metrics"""
        metrics = {
            'services': self.count_services(),
            'frontend_apps': self.count_frontend_apps(),
            'mobile_apps': self.count_mobile_apps(),
            'infrastructure_components': self.count_infrastructure(),
            'api_endpoints': self.count_api_endpoints(),
            'test_coverage': self.calculate_test_coverage()
        }
        return metrics
    
    def collect_business_metrics(self) -> Dict[str, Any]:
        """Collect business intelligence metrics"""
        metrics = {
            'market_data_freshness': self.check_market_data_freshness(),
            'competitive_analysis_age': self.check_competitive_analysis_age(),
            'customer_satisfaction_data': self.get_customer_satisfaction(),
            'financial_projections_accuracy': self.assess_financial_accuracy()
        }
        return metrics
    
    def collect_project_metrics(self) -> Dict[str, Any]:
        """Collect project progression metrics"""
        metrics = {
            'mvp_completion': self.calculate_mvp_completion(),
            'epic_completion': self.track_epic_completion(),
            'milestone_progress': self.track_milestone_progress(),
            'team_velocity': self.calculate_team_velocity()
        }
        return metrics
    
    def assess_documentation_health(self) -> Dict[str, Any]:
        """Assess current documentation health and accuracy"""
        health = {
            'technical_docs_accuracy': self.validate_technical_docs(),
            'business_docs_freshness': self.validate_business_docs(),
            'analysis_docs_relevance': self.validate_analysis_docs(),
            'overall_health_score': 0.0
        }
        
        # Calculate overall health score
        scores = [v for v in health.values() if isinstance(v, (int, float))]
        if scores:
            health['overall_health_score'] = sum(scores) / len(scores)
            
        return health
    
    def count_services(self) -> Dict[str, int]:
        """Count backend services by status"""
        services = {
            'total': 0,
            'production_ready': 0,
            'near_complete': 0,
            'in_development': 0,
            'go_services': 0
        }
        
        # Scan directories for Go services
        for item in self.base_path.iterdir():
            if item.is_dir() and (item / "go.mod").exists():
                services['total'] += 1
                services['go_services'] += 1
                
                # Determine completion status based on various indicators
                status = self.assess_service_completion(item)
                services[status] += 1
        
        return services
    
    def count_frontend_apps(self) -> Dict[str, int]:
        """Count frontend applications"""
        apps = {
            'total': 0,
            'react_apps': 0,
            'typescript_apps': 0,
            'production_ready': 0
        }
        
        # Look for React applications
        frontend_indicators = ['package.json', 'src/', 'public/']
        for item in self.base_path.iterdir():
            if item.is_dir() and (item / "package.json").exists():
                package_json = item / "package.json"
                try:
                    with open(package_json, 'r') as f:
                        package_data = json.load(f)
                        deps = package_data.get('dependencies', {})
                        
                        if 'react' in deps:
                            apps['total'] += 1
                            apps['react_apps'] += 1
                            
                            if 'typescript' in deps or '@types/react' in deps:
                                apps['typescript_apps'] += 1
                                
                            # Assess production readiness
                            if self.is_frontend_production_ready(item):
                                apps['production_ready'] += 1
                except json.JSONDecodeError:
                    continue
        
        return apps
    
    def count_mobile_apps(self) -> Dict[str, int]:
        """Count mobile applications"""
        apps = {
            'total': 0,
            'ios_apps': 0,
            'android_apps': 0,
            'react_native_apps': 0
        }
        
        # Look for mobile app indicators
        for item in self.base_path.iterdir():
            if item.is_dir():
                # Check for iOS
                if (item / "ios").exists() and (item / "ios" / "Podfile").exists():
                    apps['ios_apps'] += 1
                    apps['total'] += 1
                
                # Check for Android
                if (item / "android").exists() and (item / "android" / "build.gradle").exists():
                    apps['android_apps'] += 1
                    apps['total'] += 1
                
                # Check for React Native
                if (item / "package.json").exists():
                    try:
                        with open(item / "package.json", 'r') as f:
                            package_data = json.load(f)
                            deps = package_data.get('dependencies', {})
                            if 'react-native' in deps:
                                apps['react_native_apps'] += 1
                    except (json.JSONDecodeError, IOError):
                        continue
        
        return apps
    
    def count_infrastructure(self) -> Dict[str, int]:
        """Count infrastructure components"""
        return {
            'total': 0,
            'docker_compose_files': len(list(self.base_path.rglob("docker-compose*.yml"))),
            'kubernetes_configs': len(list(self.base_path.rglob("k8s/*.yaml"))),
            'terraform_configs': len(list(self.base_path.rglob("*.tf")))
        }
    
    def count_api_endpoints(self) -> int:
        """Count API endpoints across services"""
        # Simplified: count route definitions in Go services
        endpoint_count = 0
        for item in self.base_path.iterdir():
            if item.is_dir() and (item / "go.mod").exists():
                # Count HTTP route registrations
                for go_file in item.rglob("*.go"):
                    try:
                        with open(go_file, 'r') as f:
                            content = f.read()
                            # Count common router patterns
                            endpoint_count += content.count('.Handle(')
                            endpoint_count += content.count('.HandleFunc(')
                            endpoint_count += content.count('.GET(')
                            endpoint_count += content.count('.POST(')
                            endpoint_count += content.count('.PUT(')
                            endpoint_count += content.count('.DELETE(')
                    except IOError:
                        continue
        return endpoint_count
    
    def calculate_test_coverage(self) -> float:
        """Calculate test coverage percentage"""
        # Stub: return 0 for now
        return 0.0
    
    def check_market_data_freshness(self) -> int:
        """Check age of market data in days"""
        return 0
    
    def check_competitive_analysis_age(self) -> int:
        """Check age of competitive analysis in days"""
        return 0
    
    def get_customer_satisfaction(self) -> float:
        """Get customer satisfaction score"""
        return 0.0
    
    def assess_financial_accuracy(self) -> float:
        """Assess financial projections accuracy"""
        return 0.0
    
    def track_epic_completion(self) -> Dict[str, float]:
        """Track epic completion percentages"""
        return {'epic_1': 0.0}
    
    def track_milestone_progress(self) -> Dict[str, float]:
        """Track milestone progress"""
        return {'milestone_1': 0.0}
    
    def calculate_team_velocity(self) -> float:
        """Calculate team velocity"""
        return 0.0
    
    def validate_technical_docs(self) -> float:
        """Validate technical documentation accuracy"""
        return 0.0
    
    def validate_business_docs(self) -> float:
        """Validate business documentation freshness"""
        return 0.0
    
    def validate_analysis_docs(self) -> float:
        """Validate analysis documentation relevance"""
        return 0.0
    
    def compare_technical_metrics(self, previous: Dict, current: Dict) -> Dict:
        """Compare technical metrics between states"""
        return {}
    
    def compare_business_metrics(self, previous: Dict, current: Dict) -> Dict:
        """Compare business metrics between states"""
        return {}
    
    def compare_project_metrics(self, previous: Dict, current: Dict) -> Dict:
        """Compare project metrics between states"""
        return {}
    
    def identify_significant_changes(self, changes: Dict) -> None:
        """Identify significant changes"""
        pass
    
    def generate_technical_recommendations(self, changes: Dict) -> List[Dict]:
        """Generate technical documentation recommendations"""
        return []
    
    def generate_business_recommendations(self, changes: Dict) -> List[Dict]:
        """Generate business documentation recommendations"""
        return []
    
    def generate_project_recommendations(self, changes: Dict) -> List[Dict]:
        """Generate project documentation recommendations"""
        return []
    
    def prioritize_recommendations(self, recommendations: List[Dict]) -> List[Dict]:
        """Prioritize documentation recommendations"""
        return recommendations
    
    def load_historical_snapshots(self, days: int) -> List[Dict]:
        """Load historical snapshots for the specified number of days"""
        return []
    
    def analyze_technical_trends(self, snapshots: List[Dict]) -> Dict:
        """Analyze technical trends from historical data"""
        return {}
    
    def analyze_business_trends(self, snapshots: List[Dict]) -> Dict:
        """Analyze business trends from historical data"""
        return {}
    
    def analyze_project_trends(self, snapshots: List[Dict]) -> Dict:
        """Analyze project trends from historical data"""
        return {}
    
    def analyze_health_trends(self, snapshots: List[Dict]) -> Dict:
        """Analyze documentation health trends"""
        return {}
    
    def calculate_mvp_completion(self) -> float:
        """Calculate current MVP completion percentage"""
        # This would integrate with your project management system
        # For now, we'll calculate based on service completion
        services = self.count_services()
        if services['total'] == 0:
            return 0.0
        
        # Weight different completion states
        weighted_completion = (
            services['production_ready'] * 1.0 +
            services['near_complete'] * 0.8 +
            services['in_development'] * 0.3
        )
        
        # Assuming 31 total services target for MVP
        target_services = 31
        completion_percentage = min((weighted_completion / target_services) * 100, 100.0)
        return round(completion_percentage, 1)
    
    def detect_changes(self, previous_state: Dict[str, Any]) -> Dict[str, Any]:
        """Detect significant changes since previous scan"""
        current_state = self.scan_repository_state()
        changes = {
            'timestamp': current_state['timestamp'],
            'significant_changes': [],
            'technical_changes': self.compare_technical_metrics(
                previous_state.get('technical_metrics', {}),
                current_state['technical_metrics']
            ),
            'business_changes': self.compare_business_metrics(
                previous_state.get('business_metrics', {}),
                current_state['business_metrics']
            ),
            'project_changes': self.compare_project_metrics(
                previous_state.get('project_metrics', {}),
                current_state['project_metrics']
            )
        }
        
        # Identify significant changes
        self.identify_significant_changes(changes)
        
        return changes
    
    def generate_update_recommendations(self, changes: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate documentation update recommendations based on changes"""
        recommendations = []
        
        # Technical documentation updates
        if changes['technical_changes']:
            recommendations.extend(self.generate_technical_recommendations(changes['technical_changes']))
        
        # Business intelligence updates
        if changes['business_changes']:
            recommendations.extend(self.generate_business_recommendations(changes['business_changes']))
        
        # Project analysis updates
        if changes['project_changes']:
            recommendations.extend(self.generate_project_recommendations(changes['project_changes']))
        
        # Prioritize recommendations
        recommendations = self.prioritize_recommendations(recommendations)
        
        return recommendations
    
    def save_historical_snapshot(self, state: Dict[str, Any]) -> None:
        """Save current state as historical snapshot"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"state_snapshot_{timestamp}.json"
        filepath = self.history_path / filename
        
        with open(filepath, 'w') as f:
            json.dump(state, f, indent=2, default=str)
    
    def generate_trend_analysis(self, days: int = 30) -> Dict[str, Any]:
        """Generate trend analysis for the specified number of days"""
        snapshots = self.load_historical_snapshots(days)
        
        if len(snapshots) < 2:
            return {'error': 'Insufficient historical data for trend analysis'}
        
        trends = {
            'period': f"{days} days",
            'snapshots_analyzed': len(snapshots),
            'technical_trends': self.analyze_technical_trends(snapshots),
            'business_trends': self.analyze_business_trends(snapshots),
            'project_trends': self.analyze_project_trends(snapshots),
            'overall_health_trend': self.analyze_health_trends(snapshots)
        }
        
        return trends
    
    def run_continuous_monitoring(self) -> None:
        """Run continuous monitoring cycle"""
        print(f"Starting NetNeural Documentation State Monitor at {datetime.now()}")
        
        # Load previous state if exists
        previous_state = self.load_latest_state()
        
        # Scan current state
        current_state = self.scan_repository_state()
        print(f"Current MVP Completion: {current_state['project_metrics']['mvp_completion']}%")
        
        # Detect changes
        changes = self.detect_changes(previous_state or {})
        
        # Generate recommendations
        recommendations = self.generate_update_recommendations(changes)
        
        # Save current state
        self.save_historical_snapshot(current_state)
        
        # Output results
        self.output_monitoring_results(current_state, changes, recommendations)
        
        # Generate trend analysis if sufficient data
        trends = self.generate_trend_analysis(30)
        if 'error' not in trends:
            self.output_trend_analysis(trends)
    
    # Helper methods (simplified implementations)
    def assess_service_completion(self, service_path: Path) -> str:
        """Assess service completion status"""
        # Check for various completion indicators
        indicators = {
            'dockerfile': (service_path / "Dockerfile").exists(),
            'tests': (service_path / "test").exists() or (service_path / "*_test.go").exists(),
            'readme': (service_path / "README.md").exists(),
            'main_go': (service_path / "main.go").exists()
        }
        
        completion_score = sum(indicators.values()) / len(indicators)
        
        if completion_score >= 0.8:
            return 'production_ready'
        elif completion_score >= 0.6:
            return 'near_complete'
        else:
            return 'in_development'
    
    def is_frontend_production_ready(self, app_path: Path) -> bool:
        """Check if frontend app is production ready"""
        indicators = [
            (app_path / "dist").exists() or (app_path / "build").exists(),
            (app_path / "Dockerfile").exists(),
            (app_path / "src").exists(),
            (app_path / "README.md").exists()
        ]
        return sum(indicators) >= 3
    
    def load_latest_state(self) -> Dict[str, Any]:
        """Load the most recent state snapshot"""
        if not self.history_path.exists():
            return {}
        
        snapshot_files = list(self.history_path.glob("state_snapshot_*.json"))
        if not snapshot_files:
            return {}
        
        latest_file = max(snapshot_files, key=lambda x: x.stat().st_mtime)
        with open(latest_file, 'r') as f:
            return json.load(f)
    
    def output_monitoring_results(self, state: Dict[str, Any], changes: Dict[str, Any], recommendations: List[Dict[str, Any]]) -> None:
        """Output monitoring results"""
        print("\n" + "="*80)
        print("NETNEURAL DOCUMENTATION STATE MONITOR RESULTS")
        print("="*80)
        
        # Current state summary
        print(f"\nCurrent State Summary ({state['timestamp']}):")
        print(f"  MVP Completion: {state['project_metrics']['mvp_completion']}%")
        print(f"  Total Services: {state['technical_metrics']['services']['total']}")
        print(f"  Production Ready: {state['technical_metrics']['services']['production_ready']}")
        print(f"  Documentation Health: {state['documentation_health']['overall_health_score']:.1f}/10")
        
        # Significant changes
        if changes['significant_changes']:
            print(f"\nSignificant Changes Detected:")
            for change in changes['significant_changes'][:5]:  # Top 5
                print(f"  • {change}")
        
        # Recommendations
        if recommendations:
            print(f"\nDocumentation Update Recommendations:")
            for rec in recommendations[:5]:  # Top 5
                priority = rec.get('priority', 'medium').upper()
                print(f"  [{priority}] {rec['description']}")
        
        print("\n" + "="*80)

if __name__ == "__main__":
    monitor = DocumentationStateMonitor()
    monitor.run_continuous_monitoring()
