<?php

	if (array_key_exists("recordScore", $_POST)) {
		
		require 'config.php';
		$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_SCHEMA);
		$stmt = $conn->prepare(
			'INSERT INTO score (username, score, played_on_date) VALUES (?, ?, NOW())'
		);
		if ($stmt) {
			$stmt->bind_param('ss', $_POST['username'], $_POST['score']);
			$stmt->execute();
			$stmt->close();
		}
		$conn->close();

	} else if (array_key_exists("getScores", $_GET)) {
		
		// get high scores

	}