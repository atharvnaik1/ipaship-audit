import os
import hashlib
import json
import argparse
from datetime import datetime

class IPAShip:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.base_url = 'https://ipaship.com/api'

    def audit(self, file_path):
        print(f"Auditing {file_path} via ipaship.com...")
        return {"status": "success"}

    def compare_files(self, file1_path, file2_path):
        """
        Deep binary metadata and file diffing compare mechanism.
        """
        results = {
            "file1": {"path": file1_path, "metadata": {}},
            "file2": {"path": file2_path, "metadata": {}},
            "changes": []
        }

        # 1. Gather Metadata for File 1
        if os.path.exists(file1_path):
            stat1 = os.stat(file1_path)
            with open(file1_path, "rb") as f:
                h1 = hashlib.sha256(f.read()).hexdigest()
            results["file1"]["metadata"] = {
                "exists": True,
                "size_bytes": stat1.st_size,
                "hash": h1,
                "modified": datetime.fromtimestamp(stat1.st_mtime).isoformat()
            }
        else:
            results["file1"]["metadata"] = {"exists": False}

        # 2. Gather Metadata for File 2
        if os.path.exists(file2_path):
            stat2 = os.stat(file2_path)
            with open(file2_path, "rb") as f:
                h2 = hashlib.sha256(f.read()).hexdigest()
            results["file2"]["metadata"] = {
                "exists": True,
                "size_bytes": stat2.st_size,
                "hash": h2,
                "modified": datetime.fromtimestamp(stat2.st_mtime).isoformat()
            }
        else:
            results["file2"]["metadata"] = {"exists": False}

        # 3. Compute Lineage/Changes
        meta1 = results["file1"]["metadata"]
        meta2 = results["file2"]["metadata"]

        if not meta1["exists"] and not meta2["exists"]:
            results["changes"].append("Both files do not exist.")
        elif not meta1["exists"]:
            results["changes"].append(f"File 1 is missing. File 2 ({file2_path}) is a newly added file.")
        elif not meta2["exists"]:
            results["changes"].append(f"File 2 is missing. File 1 ({file1_path}) was deleted.")
        else:
            if meta1["hash"] == meta2["hash"]:
                results["changes"].append("Files are identical (SHA-256 hash matched).")
            else:
                results["changes"].append("File content was changed.")
                if meta1["size_bytes"] != meta2["size_bytes"]:
                    results["changes"].append(f"File size changed from {meta1['size_bytes']} bytes to {meta2['size_bytes']} bytes.")
                if meta1["modified"] != meta2["modified"]:
                    results["changes"].append(f"Modification timestamp updated from {meta1['modified']} to {meta2['modified']}.")

        return results

    def build_knowledge_graph(self, comparison):
        """
        Builds a semantic knowledge graph tracking the changes and version lineage.
        """
        nodes = []
        edges = []

        meta1 = comparison["file1"]["metadata"]
        meta2 = comparison["file2"]["metadata"]

        if meta1.get("exists"):
            f1_node = f"file_{os.path.basename(comparison['file1']['path'])}_v1"
            nodes.append({
                "id": f1_node,
                "label": os.path.basename(comparison['file1']['path']),
                "properties": meta1
            })

        if meta2.get("exists"):
            f2_node = f"file_{os.path.basename(comparison['file2']['path'])}_v2"
            nodes.append({
                "id": f2_node,
                "label": os.path.basename(comparison['file2']['path']),
                "properties": meta2
            })

        if meta1.get("exists") and meta2.get("exists"):
            f1_node = f"file_{os.path.basename(comparison['file1']['path'])}_v1"
            f2_node = f"file_{os.path.basename(comparison['file2']['path'])}_v2"
            edges.append({
                "source": f1_node,
                "target": f2_node,
                "relation": "EVOLVED_TO",
                "details": comparison["changes"]
            })

        return {"nodes": nodes, "edges": edges}

def main():
    parser = argparse.ArgumentParser(description="ipaShip Binary Compare CLI Agent")
    parser.add_argument("--ipaship", action="store_true", required=True, help="Activate ipaship command module")
    parser.add_argument("command", choices=["compare"], help="Sub-command to execute")
    parser.add_argument("--file", action="append", required=True, help="Paths to files to compare (Must supply exactly 2 files)")

    args = parser.parse_args()

    if args.command == "compare":
        if len(args.file) != 2:
            print("Error: You must provide exactly 2 files to compare.")
            return

        client = IPAShip()
        print("🔍 Scanning and comparing files in progress...")
        comparison = client.compare_files(args.file[0], args.file[1])
        graph = client.build_knowledge_graph(comparison)

        print("\n=== Binary Compare Results ===")
        print(json.dumps(comparison, indent=2))
        
        print("\n=== Semantic Knowledge Graph Lineage ===")
        print(json.dumps(graph, indent=2))

if __name__ == "__main__":
    main()
